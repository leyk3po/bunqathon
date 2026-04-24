from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse

from app.core import events
from app.core.database import get_db
from app.drops.models import Drop

router = APIRouter(tags=["drops-stream"])

HEARTBEAT_SECONDS = 15


@router.get("/drops/{slug}/stream")
async def stream_drop(slug: str, request: Request, db: Session = Depends(get_db)) -> StreamingResponse:
    drop = db.scalar(select(Drop).where(Drop.slug == slug))
    if drop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "drop not found")

    queue = events.subscribe(slug)

    async def event_source():
        try:
            yield _format_event("snapshot", _snapshot_payload(drop))
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                    continue
                yield _format_event(payload.get("type", "update"), payload)
        finally:
            events.unsubscribe(slug, queue)

    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
    }
    return StreamingResponse(event_source(), media_type="text/event-stream", headers=headers)


def _format_event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


def _snapshot_payload(drop: Drop) -> dict:
    return {
        "type": "snapshot",
        "id": drop.id,
        "slug": drop.slug,
        "title": drop.title,
        "state": drop.state.value,
        "inventory": drop.inventory,
        "sold_count": drop.sold_count,
        "price_cents": drop.price_cents,
        "currency": drop.currency,
        "bunq_tab_url": drop.bunq_tab_url,
        "media_url": drop.media_url,
    }
