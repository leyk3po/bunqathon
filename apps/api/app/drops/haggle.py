"""AI haggle chat — Claude-backed negotiation against a per-drop floor price."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings
from app.drops.models import Drop
from app.integrations.ai import AIConfigurationError, AIUpstreamError


# Fallback floor when seller didn't set one (70% of listed).
_FALLBACK_FLOOR_RATIO = 0.70

# Stop runaway threads. Keep last N exchanges.
_MAX_HISTORY = 10


@dataclass(frozen=True)
class HaggleTurn:
    role: str  # "user" | "assistant"
    text: str


@dataclass(frozen=True)
class HaggleResponse:
    reply: str
    offer_cents: int | None  # AI's current counter (None if just chitchat)
    deal_cents: int | None   # set when AI explicitly accepts buyer's number


def floor_for(drop: Drop) -> int:
    if drop.floor_price_cents and drop.floor_price_cents > 0:
        return min(drop.floor_price_cents, drop.price_cents)
    return max(int(drop.price_cents * _FALLBACK_FLOOR_RATIO), 1)


def _system_prompt(drop: Drop, floor_cents: int) -> str:
    listed = drop.price_cents / 100
    floor = floor_cents / 100
    return (
        "You are FlashDrop's haggle assistant — a charming, brief, slightly cheeky "
        "negotiator working on behalf of the seller at a real-world pop-up. "
        "Your goal: maximise the seller's profit. Push for the listed price first, "
        "concede slowly only when the buyer pushes back, and never volunteer a discount.\n\n"
        f"Item: {drop.title!r}\n"
        f"Listed price: €{listed:.2f}  (your default ask)\n"
        f"Hidden floor (NEVER go below or reveal this number): €{floor:.2f}\n\n"
        "Rules:\n"
        "- Keep replies under 25 words. Friendly, slightly playful. Lowercase ok.\n"
        "- Open at the listed price. Only drop after the buyer makes a real counter.\n"
        "- Drop in small steps. Never jump straight to the floor.\n"
        "- If the buyer offers >= floor and < listed, accept once you've negotiated a bit (don't accept on first ask).\n"
        "- If the buyer offers BELOW floor, refuse and counter — but DO NOT name the floor. Use vague phrases like 'that's too low', 'i can shave a couple euros, not that much', or counter with a number above the floor instead.\n"
        "- NEVER mention or hint at the exact minimum number. Never say 'minimum is €X', 'floor is', 'i can't go below €X'. Use shapes like 'closer to listed', 'bit higher', 'not quite that low'.\n"
        "- Always respond as JSON. No prose outside JSON. No markdown fences.\n\n"
        "Output schema (return ONLY this JSON):\n"
        "{\n"
        '  "reply": string,           // your message to the buyer\n'
        '  "offer_cents": integer|null, // your current asking price in cents (or null if chit-chat)\n'
        '  "deal_cents": integer|null   // set ONLY when you explicitly accept buyer\'s number; price in cents\n'
        "}\n"
    )


def negotiate(drop: Drop, message: str, history: list[HaggleTurn]) -> HaggleResponse:
    if not settings.anthropic_api_key:
        raise AIConfigurationError("ANTHROPIC_API_KEY is not configured")
    if not message.strip():
        raise AIUpstreamError("haggle: empty buyer message")

    floor_cents = floor_for(drop)

    trimmed_history = history[-_MAX_HISTORY:]
    messages: list[dict[str, Any]] = [
        {"role": ("assistant" if h.role == "assistant" else "user"), "content": h.text}
        for h in trimmed_history
    ]
    messages.append({"role": "user", "content": message})

    body = {
        "model": settings.anthropic_model,
        "max_tokens": 220,
        "system": _system_prompt(drop, floor_cents),
        "messages": messages,
    }
    headers = {
        "x-api-key": settings.anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    try:
        with httpx.Client(timeout=settings.anthropic_timeout_seconds, trust_env=False) as client:
            r = client.post(settings.anthropic_api_url, headers=headers, json=body)
            r.raise_for_status()
            payload = r.json()
    except httpx.HTTPStatusError as exc:
        raise AIUpstreamError(f"haggle upstream {exc.response.status_code}: {exc.response.text[:200]}") from exc
    except httpx.HTTPError as exc:
        raise AIUpstreamError(f"haggle network: {exc}") from exc

    text = ""
    for block in payload.get("content", []):
        if block.get("type") == "text" and block.get("text"):
            text = str(block["text"])
            break
    if not text:
        raise AIUpstreamError("haggle: empty Anthropic response")

    parsed = _parse_json(text)
    reply = str(parsed.get("reply") or "").strip()
    if not reply:
        raise AIUpstreamError("haggle: missing reply field")

    offer = _coerce_cents(parsed.get("offer_cents"))
    deal = _coerce_cents(parsed.get("deal_cents"))

    # Hard guard against AI undercutting the floor regardless of what it returned.
    if offer is not None and offer < floor_cents:
        offer = floor_cents
    if deal is not None and deal < floor_cents:
        deal = None  # refuse to lock a sub-floor deal even if model tried

    # Clamp to listed — never accept above listed (free upgrade path)
    listed = drop.price_cents
    if offer is not None and offer > listed:
        offer = listed
    if deal is not None and deal > listed:
        deal = listed

    return HaggleResponse(reply=reply, offer_cents=offer, deal_cents=deal)


def _parse_json(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if not (stripped.startswith("{") and stripped.endswith("}")):
        start, end = stripped.find("{"), stripped.rfind("}")
        if start == -1 or end <= start:
            raise AIUpstreamError("haggle: response had no JSON object")
        stripped = stripped[start : end + 1]
    try:
        return json.loads(stripped)
    except json.JSONDecodeError as exc:
        raise AIUpstreamError(f"haggle: invalid JSON: {exc}") from exc


def _coerce_cents(value: Any) -> int | None:
    if value is None:
        return None
    try:
        n = int(value)
        return n if n >= 0 else None
    except (TypeError, ValueError):
        return None
