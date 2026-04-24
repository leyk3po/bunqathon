from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from app.config import settings

engine = None
SessionLocal = None

if settings.database_url:
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def database_status() -> tuple[bool, str]:
    if engine is None:
        return False, "DATABASE_URL is not configured"

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, "database connection healthy"
    except SQLAlchemyError as exc:
        return False, str(exc.__class__.__name__)
