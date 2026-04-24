from __future__ import annotations

import re
import secrets

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import events
from app.drops.models import Drop, DropState, Payment, PaymentStatus
from app.drops.schemas import DropCreate, DropUpdate
from app.integrations import bunq

_SLUG_SAFE = re.compile(r"[^a-z0-9]+")


class DropError(Exception):
    """Base domain error — routers translate to HTTP."""


class DropNotFound(DropError):
    pass


class DropConflict(DropError):
    pass


class DropInvalid(DropError):
    pass


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
    data = payload.model_dump(exclude_unset=True)
    if "currency" in data and data["currency"]:
        data["currency"] = data["currency"].upper()
    for key, value in data.items():
        setattr(drop, key, value)

    _auto_state_from_inventory(drop)
    db.commit()
    db.refresh(drop)
    return drop


def publish_drop(db: Session, drop_id: str) -> Drop:
    drop = get_by_id(db, drop_id)
    if drop.state in (DropState.archived, DropState.expired):
        raise DropConflict(f"cannot publish drop in state {drop.state.value}")
    if drop.price_cents <= 0:
        raise DropInvalid("price must be > 0 before publishing")

    tab = bunq.create_bunqme_tab(
        amount_cents=drop.price_cents,
        currency=drop.currency,
        description=drop.title,
        drop_slug=drop.slug,
    )
    drop.bunq_tab_url = tab.share_url
    drop.bunq_tab_uuid = tab.uuid
    drop.state = DropState.live

    pending = Payment(
        drop_id=drop.id,
        amount_cents=drop.price_cents,
        currency=drop.currency,
        bunq_reference=tab.payment_reference,
        status=PaymentStatus.pending,
    )
    db.add(pending)
    db.commit()
    db.refresh(drop)

    events.publish(
        drop.slug,
        {"type": "published", "state": drop.state.value, "bunq_tab_url": drop.bunq_tab_url},
    )
    return drop


def apply_payment_event(
    db: Session,
    reference: str,
    new_status: PaymentStatus,
    amount_cents: int | None = None,
) -> tuple[Drop, Payment]:
    payment = db.scalar(select(Payment).where(Payment.bunq_reference == reference))
    if payment is None:
        raise DropNotFound("payment not found for reference")
    drop = db.get(Drop, payment.drop_id)
    if drop is None:
        raise DropNotFound("drop missing")

    payment.status = new_status
    if amount_cents is not None:
        payment.amount_cents = amount_cents

    if new_status == PaymentStatus.paid:
        drop.sold_count = drop.sold_count + 1
        drop.inventory = max(0, drop.inventory - 1)
        drop.state = DropState.sold_out if drop.inventory <= 0 else DropState.partially_sold

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


def _auto_state_from_inventory(drop: Drop) -> None:
    if drop.state in (DropState.paused, DropState.archived, DropState.expired, DropState.draft):
        return
    if drop.inventory <= 0:
        drop.state = DropState.sold_out
    elif drop.sold_count > 0:
        drop.state = DropState.partially_sold
    elif drop.state == DropState.sold_out:
        drop.state = DropState.live
