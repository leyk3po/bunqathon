from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi import APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import init_db
from app.core.schemas import ApiMeta
from app.auth.router import router as auth_router
from app.drops.router import router as drops_router
from app.drops.stream import router as drops_stream_router
from app.health.router import router as health_router
from app.media.constants import UPLOAD_DIR
from app.media.router import router as media_router
from app.notifications.router import router as notifications_router
from app.webhooks.router import router as webhooks_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    api_router = APIRouter(prefix="/api/v1")
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="FlashDrop hackathon API: drops, media, AI, bunq, webhooks, live stream.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_origin_regex=r".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    for router in (
        health_router,
        auth_router,
        drops_router,
        drops_stream_router,
        media_router,
        notifications_router,
        webhooks_router,
    ):
        api_router.include_router(router)

    app.include_router(api_router)

    app.mount("/media", StaticFiles(directory=str(UPLOAD_DIR)), name="media")

    @app.get("/", response_model=ApiMeta, tags=["meta"])
    def read_root() -> ApiMeta:
        return ApiMeta(
            name=settings.app_name,
            environment=settings.app_env,
            docs="/docs",
            health="/api/v1/health",
            api_base="/api/v1",
        )

    return app


app = create_app()
