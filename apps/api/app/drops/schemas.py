from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.drops.models import DropState, EventSource, PaymentStatus


class DropCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    pitch: str | None = None
    price_cents: int = Field(ge=0, default=0)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    inventory: int = Field(ge=1, default=1)
    media_url: str | None = None
    seller_id: str | None = None
    slug: str | None = None


class DropUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    pitch: str | None = None
    price_cents: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    inventory: int | None = Field(default=None, ge=0)
    media_url: str | None = None


class PaymentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    amount_cents: int
    currency: str
    status: PaymentStatus
    created_at: datetime


class DropPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    title: str
    description: str
    price_cents: int
    currency: str
    inventory: int
    sold_count: int
    media_url: str | None
    bunq_tab_url: str | None
    state: DropState
    created_at: datetime
    updated_at: datetime


class DropDetail(DropPublic):
    pitch: str | None
    seller_id: str | None
    bunq_tab_uuid: str | None
    payments: list[PaymentPublic] = Field(default_factory=list)


class EventLogPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source: EventSource
    event_type: str
    external_id: str | None
    payload: dict
    processed_at: datetime | None
    created_at: datetime


class GeneratePreviewRequest(BaseModel):
    pitch: str = Field(min_length=1, max_length=2000)
    media_url: str | None = None


class GeneratePreviewResponse(BaseModel):
    title: str
    description: str
    price_cents: int
    currency: str
