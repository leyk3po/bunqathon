"""bunq.me tab stub. Replace with real bunq API client when sandbox creds available."""

from __future__ import annotations

import secrets
from dataclasses import dataclass


@dataclass(frozen=True)
class BunqTab:
    uuid: str
    share_url: str
    payment_reference: str


def create_bunqme_tab(
    amount_cents: int,
    currency: str,
    description: str,
    drop_slug: str,
) -> BunqTab:
    uuid = secrets.token_urlsafe(16)
    token = secrets.token_urlsafe(10).replace("_", "").replace("-", "")[:12]
    return BunqTab(
        uuid=uuid,
        share_url=f"https://bunq.me/flashdrop/{token}/{amount_cents / 100:.2f}/{drop_slug}",
        payment_reference=f"flashdrop-{drop_slug}-{secrets.token_hex(4)}",
    )
