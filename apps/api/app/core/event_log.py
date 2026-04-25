from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.drops.models import Drop, EventLog, EventSource, Payment


def record_event(
    db: Session,
    *,
    event_type: str,
    source: EventSource,
    payload: dict[str, Any],
    drop: Drop | None = None,
    payment: Payment | None = None,
    external_id: str | None = None,
    processed: bool = True,
) -> EventLog:
    event = EventLog(
        drop_id=drop.id if drop else None,
        payment_id=payment.id if payment else None,
        source=source,
        event_type=event_type,
        external_id=external_id,
        payload=payload,
        processed_at=datetime.now(timezone.utc) if processed else None,
    )
    db.add(event)
    return event


def record_event_if_new(
    db: Session,
    *,
    event_type: str,
    source: EventSource,
    payload: dict[str, Any],
    drop: Drop | None = None,
    payment: Payment | None = None,
    external_id: str,
    processed: bool = True,
) -> EventLog | None:
    existing = db.scalar(
        select(EventLog.id).where(
            EventLog.source == source,
            EventLog.external_id == external_id,
        )
    )
    if existing is not None:
        return None

    return record_event(
        db,
        event_type=event_type,
        source=source,
        payload=payload,
        drop=drop,
        payment=payment,
        external_id=external_id,
        processed=processed,
    )
