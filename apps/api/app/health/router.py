from fastapi import APIRouter

from app.core.database import database_status

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/database")
def health_database() -> dict[str, str]:
    ok, detail = database_status()
    return {
        "status": "ok" if ok else "unavailable",
        "detail": detail,
    }
