from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DropState(str, enum.Enum):
    draft = "draft"
    processing = "processing"
    review = "review"
    live = "live"
    partially_sold = "partially_sold"
    sold_out = "sold_out"
    paused = "paused"
    expired = "expired"
    archived = "archived"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    expired = "expired"


class Drop(Base):
    __tablename__ = "drops"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    seller_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    pitch: Mapped[str | None] = mapped_column(Text, nullable=True)

    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")

    inventory: Mapped[int] = mapped_column(Integer, default=1)
    sold_count: Mapped[int] = mapped_column(Integer, default=0)

    media_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bunq_tab_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bunq_tab_uuid: Mapped[str | None] = mapped_column(String(64), nullable=True)

    state: Mapped[DropState] = mapped_column(
        Enum(DropState, name="drop_state"), default=DropState.draft, index=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    payments: Mapped[list["Payment"]] = relationship(
        back_populates="drop", cascade="all, delete-orphan"
    )


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    drop_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("drops.id", ondelete="CASCADE"), index=True
    )
    amount_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    bunq_reference: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status"), default=PaymentStatus.pending
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    drop: Mapped[Drop] = relationship(back_populates="payments")
