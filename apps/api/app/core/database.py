from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

DEFAULT_SQLITE_PATH = Path(__file__).resolve().parent.parent.parent / "flashdrop.db"
_database_url = settings.database_url or f"sqlite:///{DEFAULT_SQLITE_PATH}"

_connect_args: dict = {}
if _database_url.startswith("sqlite"):
    _connect_args["check_same_thread"] = False

engine = create_engine(_database_url, pool_pre_ping=True, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_database_url() -> str:
    return _database_url


def register_models() -> None:
    # Import domain models so tables register on Base.metadata.
    from app.drops import models as _drops_models  # noqa: F401


def init_db() -> None:
    register_models()


def get_db() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def database_status() -> tuple[bool, str]:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, f"database connection healthy ({engine.url.drivername})"
    except SQLAlchemyError as exc:
        return False, str(exc.__class__.__name__)
