from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.drops import service as drops_service
from app.webhooks.responses import BunqWebhookResponse
from app.webhooks.schemas import BunqPaymentEvent

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/bunq", response_model=BunqWebhookResponse, status_code=status.HTTP_200_OK)
def bunq_callback(payload: BunqPaymentEvent, db: Session = Depends(get_db)) -> BunqWebhookResponse:
    try:
        drop, _payment = drops_service.apply_payment_event(
            db,
            reference=payload.reference,
            new_status=payload.status,
            amount_cents=payload.amount_cents,
            webhook_event_id=payload.event_id,
            webhook_payload=payload.model_dump(),
        )
    except drops_service.DropNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except drops_service.DropError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    return BunqWebhookResponse(status="ok", drop_state=drop.state.value)
