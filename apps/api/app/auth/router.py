from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.models import Seller
from app.auth.schemas import AuthResponse, SellerLogin, SellerPublic, SellerRegister
from app.auth import service
from app.core.database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


def _translate(exc: service.AuthError) -> HTTPException:
    if isinstance(exc, service.AuthConflict):
        return HTTPException(status.HTTP_409_CONFLICT, str(exc))
    if isinstance(exc, service.AuthInvalid):
        return HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))


def _auth_response(seller: Seller) -> AuthResponse:
    return AuthResponse(
        access_token=service.issue_access_token(seller),
        seller=seller,
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: SellerRegister, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        seller = service.register_seller(db, payload)
    except service.AuthError as exc:
        raise _translate(exc) from exc
    return _auth_response(seller)


@router.post("/login", response_model=AuthResponse)
def login(payload: SellerLogin, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        seller = service.authenticate_seller(db, payload)
    except service.AuthError as exc:
        raise _translate(exc) from exc
    return _auth_response(seller)


@router.get("/me", response_model=SellerPublic)
def me(current_seller: Seller = Depends(service.get_current_seller)) -> SellerPublic:
    return current_seller
