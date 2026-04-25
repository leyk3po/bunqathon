from pydantic import BaseModel, Field

from app.drops.models import PaymentStatus


class BunqPaymentEvent(BaseModel):
    model_config = {
        "json_schema_extra": {
            "example": {
                "event_id": "bunq-event-123",
                "reference": "flashdrop-midnight-market-tote-a1b2-ff00aa11",
                "amount_cents": 2450,
                "status": "paid",
            }
        }
    }

    event_id: str | None = None
    reference: str = Field(min_length=1)
    amount_cents: int | None = None
    status: PaymentStatus = PaymentStatus.paid


class BunqRegisterCallbacksRequest(BaseModel):
    callback_url: str | None = None
    categories: list[str] = Field(default_factory=lambda: ["TAB_RESULT"])
