from fastapi import APIRouter

from app.core.database import database_status
from app.health.schemas import DatabaseHealthResponse, HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/health/database", response_model=DatabaseHealthResponse)
def health_database() -> DatabaseHealthResponse:
    ok, detail = database_status()
    return DatabaseHealthResponse(
        status="ok" if ok else "unavailable",
        detail=detail,
    )
