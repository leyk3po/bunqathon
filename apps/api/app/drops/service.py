from __future__ import annotations

import re
import secrets

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.event_log import record_event, record_event_if_new
from app.core import events
from app.drops.models import Drop, DropState, EventLog, EventSource, Payment, PaymentStatus
from app.drops.schemas import DropCreate, DropUpdate
from app.integrations import bunq

_SLUG_SAFE = re.compile(r"[^a-z0-9]+")
_ARCHIVABLE_STATES = {
    DropState.draft,
    DropState.processing,
    DropState.review,
    DropState.live,
    DropState.partially_sold,
    DropState.paused,
    DropState.sold_out,
    DropState.expired,
}


class DropError(Exception):
    """Base domain error — routers translate to HTTP."""


class DropNotFound(DropError):
    pass


class DropConflict(DropError):
    pass


class DropInvalid(DropError):
    pass


def _transition(drop: Drop, *, allowed: set[DropState], to_state: DropState, action: str) -> None:
    if drop.state not in allowed:
        allowed_states = ", ".join(state.value for state in sorted(allowed, key=lambda item: item.value))
        raise DropConflict(
            f"cannot {action} drop in state {drop.state.value}; allowed states: {allowed_states}"
        )
    drop.state = to_state


def _slugify(title: str) -> str:
    base = _SLUG_SAFE.sub("-", title.lower()).strip("-")[:40]
    return base or "drop"


def unique_slug(db: Session, title: str, requested: str | None) -> str:
    candidate = _slugify(requested or title)
    for _ in range(6):
        suffix = secrets.token_hex(2)
        slug = f"{candidate}-{suffix}"
        if db.scalar(select(Drop.id).where(Drop.slug == slug)) is None:
            return slug
    raise DropConflict("could not allocate unique slug")


def create_drop(db: Session, payload: DropCreate) -> Drop:
    slug = unique_slug(db, payload.title, payload.slug)
    drop = Drop(
        slug=slug,
        seller_id=payload.seller_id,
        title=payload.title,
        description=payload.description,
        pitch=payload.pitch,
        price_cents=payload.price_cents,
        currency=payload.currency.upper(),
        inventory=payload.inventory,
        media_url=payload.media_url,
        state=DropState.draft,
    )
    db.add(drop)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise DropConflict("slug collision") from exc
    record_event(
        db,
        event_type="drop.created",
        source=EventSource.domain,
        drop=drop,
        payload={
            "state": drop.state.value,
            "title": drop.title,
            "inventory": drop.inventory,
            "price_cents": drop.price_cents,
        },
    )
    db.commit()
    db.refresh(drop)
    return drop


def list_drops(
    db: Session,
    state: DropState | None = None,
    seller_id: str | None = None,
    limit: int = 50,
) -> list[Drop]:
    stmt = select(Drop).order_by(Drop.created_at.desc()).limit(limit)
    if state is not None:
        stmt = stmt.where(Drop.state == state)
    if seller_id is not None:
        stmt = stmt.where(Drop.seller_id == seller_id)
    return list(db.scalars(stmt).all())


def list_events_for_drop(db: Session, slug: str, limit: int = 100) -> list[EventLog]:
    drop = get_by_slug(db, slug)
    stmt = (
        select(EventLog)
        .where(EventLog.drop_id == drop.id)
        .order_by(EventLog.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def get_by_slug(db: Session, slug: str) -> Drop:
    drop = db.scalar(select(Drop).where(Drop.slug == slug))
    if drop is None:
        raise DropNotFound("drop not found")
    return drop


def get_by_id(db: Session, drop_id: str) -> Drop:
    drop = db.get(Drop, drop_id)
    if drop is None:
        raise DropNotFound("drop not found")
    return drop


def update_drop(db: Session, drop_id: str, payload: DropUpdate) -> Drop:
    drop = get_by_id(db, drop_id)
    if drop.state in (DropState.archived, DropState.expired):
        raise DropConflict(f"cannot update drop in state {drop.state.value}")
    data = payload.model_dump(exclude_unset=True)
    if "currency" in data and data["currency"]:
        data["currency"] = data["currency"].upper()
    for key, value in data.items():
        setattr(drop, key, value)

    _sync_active_state(drop)
    record_event(
        db,
        event_type="drop.updated",
        source=EventSource.domain,
        drop=drop,
        payload={"updated_fields": sorted(data.keys()), "state": drop.state.value},
    )
    db.commit()
    db.refresh(drop)
    return drop


def move_drop_to_review(db: Session, drop_id: str) -> Drop:
    drop = get_by_id(db, drop_id)
    _transition(
        drop,
        allowed={DropState.draft, DropState.processing},
        to_state=DropState.review,
        action="move to review",
    )
    record_event(
        db,
        event_type="drop.reviewed",
        source=EventSource.domain,
        drop=drop,
        payload={"state": drop.state.value},
    )
    db.commit()
    db.refresh(drop)
    events.publish(drop.slug, {"type": "state_changed", "state": drop.state.value})
    return drop


def publish_drop(db: Session, drop_id: str) -> Drop:
    drop = get_by_id(db, drop_id)
    _transition(
        drop,
        allowed={DropState.review},
        to_state=DropState.live,
        action="publish",
    )
    if drop.price_cents <= 0:
        raise DropInvalid("price must be > 0 before publishing")
    if drop.inventory <= 0:
        raise DropInvalid("inventory must be > 0 before publishing")

    tab = bunq.create_bunqme_tab(
        amount_cents=drop.price_cents,
        currency=drop.currency,
        description=drop.title,
        drop_slug=drop.slug,
    )
    drop.bunq_tab_url = tab.share_url
    drop.bunq_tab_uuid = tab.uuid

    pending = Payment(
        drop_id=drop.id,
        amount_cents=drop.price_cents,
        currency=drop.currency,
        bunq_reference=tab.payment_reference,
        status=PaymentStatus.pending,
    )
    db.add(pending)
    record_event(
        db,
        event_type="drop.published",
        source=EventSource.domain,
        drop=drop,
        payment=pending,
        external_id=tab.payment_reference,
        payload={
            "state": drop.state.value,
            "bunq_tab_url": drop.bunq_tab_url,
            "bunq_tab_uuid": drop.bunq_tab_uuid,
            "payment_reference": tab.payment_reference,
        },
    )
    db.commit()
    db.refresh(drop)

    events.publish(
        drop.slug,
        {
            "type": "published",
            "state": drop.state.value,
            "bunq_tab_url": drop.bunq_tab_url,
        },
    )
    return drop


def pause_drop(db: Session, drop_id: str) -> Drop:
    drop = get_by_id(db, drop_id)
    _transition(
        drop,
        allowed={DropState.live, DropState.partially_sold},
        to_state=DropState.paused,
        action="pause",
    )
    record_event(
        db,
        event_type="drop.paused",
        source=EventSource.domain,
        drop=drop,
        payload={"state": drop.state.value},
    )
    db.commit()
    db.refresh(drop)
    events.publish(drop.slug, {"type": "state_changed", "state": drop.state.value})
    return drop


def resume_drop(db: Session, drop_id: str) -> Drop:
    drop = get_by_id(db, drop_id)
    if drop.state != DropState.paused:
        raise DropConflict(f"cannot resume drop in state {drop.state.value}")
    if drop.inventory <= 0:
        raise DropConflict("cannot resume a sold out drop")
    if drop.price_cents <= 0:
        raise DropInvalid("price must be > 0 before resuming")

    drop.state = _active_state_for(drop)
    record_event(
        db,
        event_type="drop.resumed",
        source=EventSource.domain,
        drop=drop,
        payload={"state": drop.state.value},
    )
    db.commit()
    db.refresh(drop)
    events.publish(drop.slug, {"type": "state_changed", "state": drop.state.value})
    return drop


def archive_drop(db: Session, drop_id: str) -> Drop:
    drop = get_by_id(db, drop_id)
    _transition(
        drop,
        allowed=_ARCHIVABLE_STATES,
        to_state=DropState.archived,
        action="archive",
    )
    record_event(
        db,
        event_type="drop.archived",
        source=EventSource.domain,
        drop=drop,
        payload={"state": drop.state.value},
    )
    db.commit()
    db.refresh(drop)
    events.publish(drop.slug, {"type": "state_changed", "state": drop.state.value})
    return drop


def apply_payment_event(
    db: Session,
    reference: str,
    new_status: PaymentStatus,
    amount_cents: int | None = None,
    *,
    webhook_event_id: str | None = None,
    webhook_payload: dict | None = None,
) -> tuple[Drop, Payment]:
    payment = db.scalar(select(Payment).where(Payment.bunq_reference == reference))
    if payment is None:
        raise DropNotFound("payment not found for reference")
    drop = db.get(Drop, payment.drop_id)
    if drop is None:
        raise DropNotFound("drop missing")

    if webhook_payload is not None:
        if webhook_event_id:
            record_event_if_new(
                db,
                event_type="webhook.bunq.payment_received",
                source=EventSource.webhook,
                drop=drop,
                payment=payment,
                external_id=webhook_event_id,
                payload=webhook_payload,
            )
        else:
            record_event(
                db,
                event_type="webhook.bunq.payment_received",
                source=EventSource.webhook,
                drop=drop,
                payment=payment,
                payload=webhook_payload,
            )

    payment.status = new_status
    if amount_cents is not None:
        payment.amount_cents = amount_cents

    if new_status == PaymentStatus.paid:
        drop.sold_count = drop.sold_count + 1
        drop.inventory = max(0, drop.inventory - 1)
        drop.state = _active_state_for(drop)

    record_event(
        db,
        event_type="payment.status_changed",
        source=EventSource.payment,
        drop=drop,
        payment=payment,
        payload={
            "reference": reference,
            "status": payment.status.value,
            "amount_cents": payment.amount_cents,
            "drop_state": drop.state.value,
            "inventory": drop.inventory,
            "sold_count": drop.sold_count,
        },
    )
    db.commit()

    events.publish(
        drop.slug,
        {
            "type": "payment",
            "status": payment.status.value,
            "drop_state": drop.state.value,
            "inventory": drop.inventory,
            "sold_count": drop.sold_count,
        },
    )
    return drop, payment


def _active_state_for(drop: Drop) -> DropState:
    if drop.inventory <= 0:
        return DropState.sold_out
    if drop.sold_count > 0:
        return DropState.partially_sold
    return DropState.live


def _sync_active_state(drop: Drop) -> None:
    if drop.state in (
        DropState.draft,
        DropState.processing,
        DropState.review,
        DropState.paused,
        DropState.archived,
        DropState.expired,
    ):
        return
    drop.state = _active_state_for(drop)
