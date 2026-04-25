from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    drop_id: str | None
    drop_slug: str | None
    drop_title: str
    amount_cents: int
    currency: str
    read: bool
    created_at: datetime
