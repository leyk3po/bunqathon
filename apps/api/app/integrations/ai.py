"""Multimodal AI stub. Swap for Anthropic/OpenAI call later."""

from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass


@dataclass(frozen=True)
class Generated:
    title: str
    description: str
    price_cents: int
    currency: str = "EUR"


_ADJECTIVES = [
    "Limited", "Handmade", "One-of-a-kind", "Small-batch", "Late-night",
    "Campus", "Street", "Sunset", "Midnight", "Weekend",
]
_NOUNS = ["Drop", "Edition", "Capsule", "Release", "Pickup"]


def _seed_from(pitch: str, media_url: str | None) -> random.Random:
    base = f"{pitch}|{media_url or ''}"
    digest = hashlib.sha256(base.encode("utf-8")).hexdigest()
    return random.Random(int(digest[:8], 16))


def generate_drop_copy(pitch: str, media_url: str | None = None) -> Generated:
    pitch_clean = (pitch or "").strip()
    rng = _seed_from(pitch_clean, media_url)

    adj = rng.choice(_ADJECTIVES)
    noun = rng.choice(_NOUNS)
    first_words = " ".join(pitch_clean.split()[:4]) if pitch_clean else "Mystery item"
    title = f"{adj} {first_words.title()} {noun}"[:80]

    description = pitch_clean or "A spontaneous drop from the booth."
    if len(description) < 40:
        description = f"{description.rstrip('.')}. Grab it before it's gone — this is a limited real-world drop."

    price = rng.choice([500, 750, 1000, 1250, 1500, 1999, 2450, 2999, 3500, 4500])
    return Generated(title=title, description=description, price_cents=price)
