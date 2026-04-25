from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import Seller
from app.auth.schemas import SellerLogin, SellerRegister
from app.core.database import get_db
from app.core.config import settings

_bearer = HTTPBearer(auto_error=False)
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AuthError(Exception):
    pass


class AuthConflict(AuthError):
    pass


class AuthInvalid(AuthError):
    pass


def register_seller(db: Session, payload: SellerRegister) -> Seller:
    email = _normalize_email(payload.email)
    display_name = payload.display_name.strip()
    password = payload.password
    _validate_email(email)
    if len(display_name) < 2:
        raise AuthInvalid("display name is too short")
    if len(password) < 8:
        raise AuthInvalid("password must be at least 8 characters")
    seller = Seller(
        email=email,
        display_name=display_name,
        password_hash=_hash_password(password),
    )
    db.add(seller)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AuthConflict("seller email already exists") from exc
    db.refresh(seller)
    return seller


def authenticate_seller(db: Session, payload: SellerLogin) -> Seller:
    email = _normalize_email(payload.email)
    if len(payload.password) < 8:
        raise AuthInvalid("password must be at least 8 characters")
    seller = db.scalar(select(Seller).where(Seller.email == email))
    if seller is None or not _verify_password(payload.password, seller.password_hash):
        raise AuthInvalid("invalid email or password")
    return seller


def issue_access_token(seller: Seller) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": seller.id,
        "email": seller.email,
        "exp": int((now + timedelta(hours=settings.auth_token_ttl_hours)).timestamp()),
        "iat": int(now.timestamp()),
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_part = _b64encode(payload_bytes)
    signature_part = _b64encode(_sign(payload_bytes))
    return f"{payload_part}.{signature_part}"


def get_current_seller(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Seller:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "authentication required")

    seller_id = _seller_id_from_token(credentials.credentials)
    seller = db.get(Seller, seller_id)
    if seller is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "seller account not found")
    return seller


def get_optional_current_seller(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Seller | None:
    if credentials is None:
        return None
    if credentials.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid authentication scheme")

    seller_id = _seller_id_from_token(credentials.credentials)
    seller = db.get(Seller, seller_id)
    if seller is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "seller account not found")
    return seller


def _seller_id_from_token(token: str) -> str:
    try:
        payload_part, signature_part = token.split(".", 1)
        payload_bytes = _b64decode(payload_part)
        signature = _b64decode(signature_part)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid access token") from exc

    expected = _sign(payload_bytes)
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid access token")

    try:
        payload = json.loads(payload_bytes.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid access token") from exc

    exp = int(payload.get("exp") or 0)
    if exp <= int(datetime.now(timezone.utc).timestamp()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "access token expired")

    seller_id = str(payload.get("sub") or "").strip()
    if not seller_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid access token")
    return seller_id


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _validate_email(value: str) -> None:
    if not _EMAIL_RE.match(value):
        raise AuthInvalid("email address is invalid")


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    iterations = settings.auth_password_iterations
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return "pbkdf2_sha256${iterations}${salt}${hash}".format(
        iterations=iterations,
        salt=salt.hex(),
        hash=derived.hex(),
    )


def _verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations_text, salt_hex, hash_hex = stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
    except (ValueError, TypeError):
        return False

    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def _sign(payload_bytes: bytes) -> bytes:
    return hmac.new(
        settings.auth_secret.encode("utf-8"),
        payload_bytes,
        hashlib.sha256,
    ).digest()


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)
