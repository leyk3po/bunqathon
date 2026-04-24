"""In-memory pub/sub for SSE. Topic = string key (e.g. drop slug)."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

_subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)


def subscribe(topic: str) -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue(maxsize=32)
    _subscribers[topic].add(queue)
    return queue


def unsubscribe(topic: str, queue: asyncio.Queue) -> None:
    bucket = _subscribers.get(topic)
    if bucket is None:
        return
    bucket.discard(queue)
    if not bucket:
        _subscribers.pop(topic, None)


def publish(topic: str, payload: dict[str, Any]) -> None:
    for queue in list(_subscribers.get(topic, ())):
        try:
            queue.put_nowait(payload)
        except asyncio.QueueFull:
            pass


def subscriber_count(topic: str) -> int:
    return len(_subscribers.get(topic, ()))
