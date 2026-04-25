"""Anthropic-backed drop preview generation."""

from __future__ import annotations

import base64
import json
import mimetypes
import re
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings
from app.media.constants import UPLOAD_DIR


@dataclass(frozen=True)
class Generated:
    title: str
    description: str
    price_cents: int
    currency: str = "EUR"
    inventory: int = 1


class AIError(Exception):
    """Base Anthropic integration error."""


class AIConfigurationError(AIError):
    """Raised when Anthropic config is missing or invalid."""


class AIUpstreamError(AIError):
    """Raised when Anthropic request/response handling fails."""


_SUPPORTED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}
_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "minLength": 1, "maxLength": 80},
        "description": {"type": "string", "minLength": 1, "maxLength": 300},
        "price_cents": {"type": "integer", "minimum": 100, "maximum": 500000},
        "currency": {"type": "string", "enum": ["EUR"]},
        "inventory": {"type": "integer", "minimum": 1, "maximum": 10000},
    },
    "required": ["title", "description", "price_cents", "currency", "inventory"],
    "additionalProperties": False,
}
_PROMPT_SCHEMA_TEXT = json.dumps(_OUTPUT_SCHEMA, indent=2)
_NUMBER_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
}


def generate_drop_copy(pitch: str, media_url: str | None = None) -> Generated:
    return _anthropic_generate_drop_copy(pitch, media_url)


def _anthropic_generate_drop_copy(pitch: str, media_url: str | None = None) -> Generated:
    if not settings.anthropic_api_key:
        raise AIConfigurationError("ANTHROPIC_API_KEY is not configured")

    content = []

    image_block = _image_content_block(media_url)
    if image_block is not None:
        content.append(image_block)

    inventory_hint = _infer_inventory_hint(pitch)
    separate_units_hint = _mentions_separate_units(pitch)
    inventory_instruction = ""
    if inventory_hint is not None:
        inventory_instruction = (
            f"\nDetected seller stock hint: {inventory_hint} separate sellable units."
            " Treat that as inventory, not as one bundle listing."
        )
    if separate_units_hint:
        inventory_instruction += (
            "\nThe seller explicitly wants multiple separate items, not a bundle, pack, set, or lot."
        )

    content.append(
        {
            "type": "text",
            "text": (
                "You are generating copy for a pop-up storefront called FlashDrop.\n"
                "Write sharp, concise, seller-friendly output for a real-world item.\n"
                "The response must fit a fast mobile storefront.\n"
                "If the seller mentions having multiple identical items in stock, write the listing for one unit and put the quantity into inventory.\n"
                "Do not turn multiple identical units into a bundle unless the seller explicitly says bundle, pack, case, set, or lot.\n"
                "Return JSON only. Do not wrap it in markdown fences.\n"
                "Use this JSON schema exactly:\n"
                f"{_PROMPT_SCHEMA_TEXT}\n\n"
                f"Seller pitch:\n{(pitch or '').strip() or 'No pitch provided.'}"
                f"{inventory_instruction}"
            ),
        }
    )

    body = {
        "model": settings.anthropic_model,
        "max_tokens": 300,
        "system": (
            "Return a compact, commercially useful draft for a temporary mobile storefront. "
            "Do not be generic. Prefer concrete, energetic phrasing. Remember to count the amount of objects being sold in the picture correctly. "
            "Output must be valid JSON matching the provided schema."
        ),
        "messages": [
            {
                "role": "user",
                "content": content,
            }
        ],
    }

    headers = {
        "x-api-key": settings.anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    try:
        with httpx.Client(timeout=settings.anthropic_timeout_seconds, trust_env=False) as client:
            response = client.post(settings.anthropic_api_url, headers=headers, json=body)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip() or str(exc)
        raise AIUpstreamError(f"Anthropic request failed: {detail}") from exc
    except httpx.HTTPError as exc:
        raise AIUpstreamError(f"Anthropic connection failed: {exc}") from exc

    try:
        text_output = _extract_text(payload)
        parsed = json.loads(_extract_json_object(text_output))
        generated_inventory = int(parsed["inventory"])
        if inventory_hint is not None:
            generated_inventory = inventory_hint
        return Generated(
            title=str(parsed["title"]).strip()[:80],
            description=str(parsed["description"]).strip()[:300],
            price_cents=int(parsed["price_cents"]),
            currency=str(parsed["currency"]).upper(),
            inventory=max(1, generated_inventory),
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise AIUpstreamError("Anthropic response could not be parsed into preview JSON") from exc


def _extract_text(payload: dict[str, Any]) -> str:
    content = payload.get("content", [])
    for block in content:
        if block.get("type") == "text" and block.get("text"):
            return str(block["text"])
    raise ValueError("Anthropic response did not include text content")


def _extract_json_object(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        return stripped

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Anthropic response did not contain a JSON object")
    return stripped[start : end + 1]


def _image_content_block(media_url: str | None) -> dict[str, Any] | None:
    if not media_url:
        return None

    if media_url.startswith("/media/"):
        local_path = UPLOAD_DIR / media_url.removeprefix("/media/")
        if not local_path.exists():
            return None
        mime_type = mimetypes.guess_type(local_path.name)[0]
        if mime_type not in _SUPPORTED_IMAGE_MIME_TYPES:
            return None
        encoded = base64.standard_b64encode(local_path.read_bytes()).decode("utf-8")
        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": mime_type,
                "data": encoded,
            },
        }

    guessed_mime_type = mimetypes.guess_type(media_url)[0]
    if (
        media_url.startswith("http://") or media_url.startswith("https://")
    ) and guessed_mime_type in _SUPPORTED_IMAGE_MIME_TYPES:
        return {
            "type": "image",
            "source": {
                "type": "url",
                "url": media_url,
            },
        }

    return None


def _mentions_separate_units(pitch: str) -> bool:
    lower = pitch.lower()
    markers = (
        "separate item",
        "separate items",
        "separate unit",
        "separate units",
        "not as one",
        "not one go",
        "not a bundle",
        "not bundle",
        "individually",
        "one each",
    )
    return any(marker in lower for marker in markers)


def _infer_inventory_hint(pitch: str) -> int | None:
    normalized = pitch.lower()
    for word, value in _NUMBER_WORDS.items():
        normalized = re.sub(rf"\b{word}\b", str(value), normalized)

    patterns = (
        r"\bi have\s+(\d{1,4})\b",
        r"\bwe have\s+(\d{1,4})\b",
        r"\bthere (?:is|are)\s+(\d{1,4})\b",
        r"\bonly\s+(\d{1,4})\s+(?:left|available|remaining)\b",
        r"\b(\d{1,4})\s+(?:left|available|remaining|in stock)\b",
        r"\b(\d{1,4})\s+(?:separate|individual)\s+(?:items|units|cans|bottles|pieces)\b",
        r"\bsell them as\s+(\d{1,4})\s+separate\b",
    )
    for pattern in patterns:
        match = re.search(pattern, normalized)
        if match:
            return max(1, int(match.group(1)))
    return None
