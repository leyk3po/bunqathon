"""Bunq read-only views for the dashboard (balance, account info)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.integrations import bunq

router = APIRouter(prefix="/bunq", tags=["bunq"])


class BunqBalanceResponse(BaseModel):
    account_id: int
    description: str
    balance_cents: int
    currency: str
    iban: str | None = None


@router.get("/balance", response_model=BunqBalanceResponse)
def get_balance() -> BunqBalanceResponse:
    try:
        snap = bunq.fetch_account_balance()
    except bunq.BunqConfigurationError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    except bunq.BunqUpstreamError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return BunqBalanceResponse(
        account_id=snap.account_id,
        description=snap.description,
        balance_cents=snap.balance_cents,
        currency=snap.currency,
        iban=snap.iban,
    )
