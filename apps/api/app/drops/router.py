from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.models import Seller
from app.auth.service import get_current_seller, get_optional_current_seller
from app.core.database import get_db
from app.drops import service
from app.drops.models import Drop, DropState
from app.drops.schemas import (
    DropCreate,
    DropDetail,
    EventLogPublic,
    DropPublic,
    DropUpdate,
    GeneratePreviewRequest,
    GeneratePreviewResponse,
)
from app.integrations import bunq
from app.integrations import ai

router = APIRouter(prefix="/drops", tags=["drops"])


def _translate(exc: service.DropError) -> HTTPException:
    if isinstance(exc, service.DropNotFound):
        return HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    if isinstance(exc, service.DropForbidden):
        return HTTPException(status.HTTP_403_FORBIDDEN, str(exc))
    if isinstance(exc, service.DropConflict):
        return HTTPException(status.HTTP_409_CONFLICT, str(exc))
    if isinstance(exc, service.DropInvalid):
        return HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))


@router.post("/generate-preview", response_model=GeneratePreviewResponse)
def generate_preview(payload: GeneratePreviewRequest) -> GeneratePreviewResponse:
    try:
        result = ai.generate_drop_copy(payload.pitch, payload.media_url)
    except ai.AIConfigurationError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    except ai.AIUpstreamError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return GeneratePreviewResponse(
        title=result.title,
        description=result.description,
        price_cents=result.price_cents,
        currency=result.currency,
    )


@router.post("", response_model=DropDetail, status_code=status.HTTP_201_CREATED)
def create_drop(
    payload: DropCreate,
    db: Session = Depends(get_db),
    current_seller: Seller = Depends(get_current_seller),
) -> Drop:
    try:
        return service.create_drop(db, payload.model_copy(update={"seller_id": current_seller.id}))
    except service.DropError as exc:
        raise _translate(exc) from exc


@router.get("", response_model=list[DropPublic])
def list_drops(
    db: Session = Depends(get_db),
    state_filter: list[DropState] | None = Query(default=None, alias="state"),
    status_filter: list[DropState] | None = Query(default=None, alias="status"),
    seller_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    current_seller: Seller | None = Depends(get_optional_current_seller),
) -> list[Drop]:
    if seller_id is not None:
        if current_seller is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required to filter by seller")
        if current_seller.id != seller_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot list drops for another seller")
    return service.list_drops(
        db,
        states=status_filter or state_filter,
        seller_id=seller_id,
        limit=limit,
    )


@router.get("/{slug}/events", response_model=list[EventLogPublic])
def list_drop_events(
    slug: str,
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=500),
) -> list:
    try:
        return service.list_events_for_drop(db, slug, limit=limit)
    except service.DropError as exc:
        raise _translate(exc) from exc


@router.get("/{slug}", response_model=DropDetail)
def get_drop(slug: str, db: Session = Depends(get_db)) -> Drop:
    try:
        return service.get_by_slug(db, slug)
    except service.DropError as exc:
        raise _translate(exc) from exc


@router.patch("/{drop_id}", response_model=DropDetail)
def update_drop(
    drop_id: str,
    payload: DropUpdate,
    db: Session = Depends(get_db),
    current_seller: Seller = Depends(get_current_seller),
) -> Drop:
    try:
        service.ensure_owner(service.get_by_id(db, drop_id), current_seller.id)
        return service.update_drop(db, drop_id, payload)
    except service.DropError as exc:
        raise _translate(exc) from exc


@router.post("/{drop_id}/publish", response_model=DropDetail)
def publish_drop(
    drop_id: str,
    db: Session = Depends(get_db),
    current_seller: Seller = Depends(get_current_seller),
) -> Drop:
    try:
        service.ensure_owner(service.get_by_id(db, drop_id), current_seller.id)
        return service.publish_drop(db, drop_id)
    except bunq.BunqConfigurationError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    except bunq.BunqUpstreamError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    except service.DropError as exc:
        raise _translate(exc) from exc


@router.post("/{drop_id}/mock-payment", response_model=DropDetail)
def mock_payment(drop_id: str, db: Session = Depends(get_db)) -> Drop:
    try:
        return service.mock_payment_for_drop(db, drop_id)
    except service.DropError as exc:
        raise _translate(exc) from exc


@router.post("/{drop_id}/archive", response_model=DropDetail)
def archive_drop(
    drop_id: str,
    db: Session = Depends(get_db),
    current_seller: Seller = Depends(get_current_seller),
) -> Drop:
    try:
        service.ensure_owner(service.get_by_id(db, drop_id), current_seller.id)
        return service.archive_drop(db, drop_id)
    except service.DropError as exc:
        raise _translate(exc) from exc
