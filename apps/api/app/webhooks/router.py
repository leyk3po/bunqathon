from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.drops import service as drops_service
from app.integrations import bunq
from app.webhooks.responses import BunqRegisterCallbacksResponse, BunqWebhookResponse
from app.webhooks.schemas import BunqPaymentEvent, BunqRegisterCallbacksRequest

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/bunq", response_model=BunqWebhookResponse, status_code=status.HTTP_200_OK)
def bunq_callback(
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
) -> BunqWebhookResponse:
    if "reference" in payload:
        typed_payload = BunqPaymentEvent.model_validate(payload)
        try:
            drop, _payment = drops_service.apply_payment_event(
                db,
                reference=typed_payload.reference,
                new_status=typed_payload.status,
                amount_cents=typed_payload.amount_cents,
                webhook_event_id=typed_payload.event_id,
                webhook_payload=typed_payload.model_dump(),
            )
        except drops_service.DropNotFound as exc:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
        except drops_service.DropError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

        return BunqWebhookResponse(status="ok", drop_state=drop.state.value)

    try:
        resolved = bunq.resolve_payment_callback(payload)
    except bunq.BunqUnsupportedWebhook as exc:
        return BunqWebhookResponse(status="ignored", detail=str(exc))
    except bunq.BunqConfigurationError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    except bunq.BunqUpstreamError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

    try:
        drop, _payment = drops_service.apply_payment_event(
            db,
            reference=resolved.reference,
            new_status=resolved.status,
            amount_cents=resolved.amount_cents,
            webhook_event_id=resolved.event_id,
            webhook_payload=resolved.payload,
        )
    except drops_service.DropNotFound as exc:
        return BunqWebhookResponse(status="unmatched", detail=str(exc))
    except drops_service.DropError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    return BunqWebhookResponse(status="ok", drop_state=drop.state.value)


@router.post(
    "/bunq/register",
    response_model=BunqRegisterCallbacksResponse,
    status_code=status.HTTP_200_OK,
)
def register_bunq_callbacks(payload: BunqRegisterCallbacksRequest) -> BunqRegisterCallbacksResponse:
    try:
        result = bunq.register_callback_url(
            callback_url=payload.callback_url,
            categories=payload.categories,
        )
    except bunq.BunqConfigurationError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    except bunq.BunqUpstreamError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

    return BunqRegisterCallbacksResponse(
        status="ok",
        callback_url=result["callback_url"],
        categories=result["categories"],
    )
