from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.auth.models import Seller
from app.auth.service import get_current_seller
from app.core.database import get_db
from app.notifications import service
from app.notifications.schemas import NotificationPublic

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationPublic])
def list_notifications(
    db: Session = Depends(get_db),
    current_seller: Seller = Depends(get_current_seller),
) -> list[NotificationPublic]:
    return service.list_notifications(db, seller_id=current_seller.id)


@router.post("/read")
def mark_read(
    db: Session = Depends(get_db),
    current_seller: Seller = Depends(get_current_seller),
) -> Response:
    service.mark_all_read(db, seller_id=current_seller.id)
    return Response(status_code=204)
