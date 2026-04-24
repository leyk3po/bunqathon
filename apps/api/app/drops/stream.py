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
    exists = db.scalar(select(Drop.id).where(Drop.slug == slug))
    if exists is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "drop not found")

    queue = events.subscribe(slug)

    async def event_source():
        try:
            yield _format_event("ready", {"slug": slug})
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
