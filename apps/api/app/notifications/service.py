from __future__ import annotations

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.notifications.models import Notification


def create_notification(db: Session, *, seller_id: str, drop_id: str, drop_title: str, amount_cents: int, currency: str) -> None:
    db.add(Notification(
        seller_id=seller_id,
        drop_id=drop_id,
        drop_title=drop_title,
        amount_cents=amount_cents,
        currency=currency,
    ))


def list_notifications(db: Session, seller_id: str, limit: int = 50) -> list[Notification]:
    stmt = (
        select(Notification)
        .where(Notification.seller_id == seller_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def mark_all_read(db: Session, seller_id: str) -> None:
    db.execute(
        update(Notification)
        .where(Notification.seller_id == seller_id, Notification.read == False)  # noqa: E712
        .values(read=True)
    )
    db.commit()
