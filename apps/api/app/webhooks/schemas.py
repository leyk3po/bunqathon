from pydantic import BaseModel, Field

from app.drops.models import PaymentStatus


class BunqPaymentEvent(BaseModel):
    event_id: str | None = None
    reference: str = Field(min_length=1)
    amount_cents: int | None = None
    status: PaymentStatus = PaymentStatus.paid
