from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.drops.models import DropState, EventSource, PaymentStatus


class DropCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Midnight Market Tote",
                "description": "Student-made tote bag from the design booth.",
                "pitch": "handmade tote for our student design club, only five left",
                "price_cents": 2450,
                "currency": "EUR",
                "inventory": 5,
                "media_url": "/media/demo-image.jpg",
                "seller_id": "demo-seller",
            }
        }
    )

    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    pitch: str | None = None
    price_cents: int = Field(ge=0, default=0)
    floor_price_cents: int | None = Field(default=None, ge=0)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    inventory: int = Field(ge=1, default=1)
    media_url: str | None = None
    seller_id: str | None = None
    slug: str | None = None
    duration_minutes: int | None = Field(default=None, ge=1)
    expires_at: datetime | None = None

    @field_validator("expires_at", mode="before")
    @classmethod
    def _ensure_tz(cls, v: object) -> object:
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class DropUpdate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Midnight Market Tote",
                "description": "Updated copy for the preview screen.",
                "price_cents": 2450,
                "inventory": 5,
            }
        }
    )

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    pitch: str | None = None
    price_cents: int | None = Field(default=None, ge=0)
    floor_price_cents: int | None = Field(default=None, ge=0)
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
    floor_price_cents: int | None = None
    currency: str
    inventory: int
    sold_count: int
    media_url: str | None
    bunq_tab_url: str | None
    state: DropState
    duration_minutes: int | None
    expires_at: datetime | None
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
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "pitch": "handmade tote for our student design club, only five left",
                "media_url": "/media/demo-image.jpg",
            }
        }
    )

    pitch: str = Field(min_length=1, max_length=2000)
    media_url: str | None = None


class HaggleTurn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    text: str = Field(min_length=1, max_length=600)


class HaggleRequest(BaseModel):
    message: str = Field(min_length=1, max_length=600)
    history: list[HaggleTurn] = Field(default_factory=list, max_length=20)


class HaggleResponse(BaseModel):
    reply: str
    offer_cents: int | None = None
    deal_cents: int | None = None


class GeneratePreviewResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Midnight Handmade Tote For Our Drop",
                "description": "handmade tote for our student design club, only five left",
                "price_cents": 2450,
                "currency": "EUR",
            }
        }
    )

    title: str
    description: str
    price_cents: int
    currency: str
    floor_price_cents: int | None = None
