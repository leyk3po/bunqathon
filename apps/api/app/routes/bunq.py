"""Bunq read-only views for the dashboard (balance, account info)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.drops.models import Payment, PaymentStatus
from app.integrations import bunq

router = APIRouter(prefix="/bunq", tags=["bunq"])


class BunqBalanceResponse(BaseModel):
    account_id: int
    description: str
    balance_cents: int
    real_balance_cents: int
    mocked_sales_cents: int
    sandbox: bool
    currency: str
    iban: str | None = None


def _mocked_sales_total(db: Session) -> int:
    total = db.scalar(
        select(func.coalesce(func.sum(Payment.amount_cents), 0))
        .where(Payment.status == PaymentStatus.paid)
    )
    return int(total or 0)


@router.get("/balance", response_model=BunqBalanceResponse)
def get_balance(db: Session = Depends(get_db)) -> BunqBalanceResponse:
    try:
        snap = bunq.fetch_account_balance()
    except bunq.BunqConfigurationError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    except bunq.BunqUpstreamError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

    real = snap.balance_cents
    mocked = _mocked_sales_total(db) if settings.bunq_sandbox else 0
    effective = real + mocked

    return BunqBalanceResponse(
        account_id=snap.account_id,
        description=snap.description,
        balance_cents=effective,
        real_balance_cents=real,
        mocked_sales_cents=mocked,
        sandbox=bool(settings.bunq_sandbox),
        currency=snap.currency,
        iban=snap.iban,
    )
