from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings
from app.drops.models import PaymentStatus
from app.integrations.bunq_client import BunqClient, BunqClientDependencyError, BunqClientError


@dataclass(frozen=True)
class BunqTab:
    uuid: str
    share_url: str
    payment_reference: str


@dataclass(frozen=True)
class BunqResolvedPaymentEvent:
    reference: str
    status: PaymentStatus
    amount_cents: int | None
    event_id: str
    payload: dict[str, Any]


class BunqError(Exception):
    pass


class BunqConfigurationError(BunqError):
    pass


class BunqUpstreamError(BunqError):
    pass


class BunqUnsupportedWebhook(BunqError):
    pass


def create_bunqme_tab(
    amount_cents: int,
    currency: str,
    description: str,
    drop_slug: str,
) -> BunqTab:
    client = _authenticated_client()
    account_id = _account_id(client)
    body: dict[str, Any] = {
        "bunqme_tab_entry": {
            "amount_inquired": {
                "value": _format_amount(amount_cents),
                "currency": currency.upper(),
            },
            "description": description[:140],
        }
    }
    redirect_url = _redirect_url(drop_slug)
    if redirect_url:
        body["bunqme_tab_entry"]["redirect_url"] = redirect_url

    try:
        created = client.post(
            f"user/{client.user_id}/monetary-account/{account_id}/bunqme-tab",
            body,
        )
        tab_id = int(created[0]["Id"]["id"])
        fetched = client.get(
            f"user/{client.user_id}/monetary-account/{account_id}/bunqme-tab/{tab_id}"
        )
    except (httpx.HTTPError, BunqClientError, KeyError, TypeError, ValueError) as exc:
        raise BunqUpstreamError(f"bunq.me tab creation failed: {exc}") from exc

    tab = _extract_first_nested_object(fetched)
    entry = tab.get("bunqme_tab_entry", {})
    share_url = str(tab.get("bunqme_tab_share_url") or "")
    entry_uuid = str(entry.get("uuid") or tab_id)

    return BunqTab(
        uuid=entry_uuid,
        share_url=share_url,
        payment_reference=f"bunqme-tab:{tab_id}",
    )


def register_callback_url(
    callback_url: str | None = None,
    *,
    categories: list[str] | None = None,
) -> dict[str, Any]:
    target = (callback_url or settings.bunq_callback_url).strip()
    if not target:
        raise BunqConfigurationError("BUNQ_CALLBACK_URL is not configured")
    if not target.startswith("https://"):
        raise BunqConfigurationError("bunq callback URLs must use HTTPS")

    client = _authenticated_client()
    filters = [
        {"category": category, "notification_target": target}
        for category in (categories or ["TAB_RESULT"])
    ]
    try:
        client.post(
            f"user/{client.user_id}/notification-filter-url",
            {"notification_filters": filters},
        )
    except (httpx.HTTPError, BunqClientError) as exc:
        raise BunqUpstreamError(f"bunq callback registration failed: {exc}") from exc

    return {"callback_url": target, "categories": [item["category"] for item in filters]}


def resolve_payment_callback(payload: dict[str, Any]) -> BunqResolvedPaymentEvent:
    notification = _extract_notification(payload)
    category = str(notification.get("category") or "").upper()
    object_id = notification.get("object_id")
    if not category or object_id in (None, ""):
        raise BunqUnsupportedWebhook("bunq webhook payload does not contain category/object_id")

    if category != "TAB_RESULT":
        raise BunqUnsupportedWebhook(f"unsupported bunq webhook category: {category}")

    client = _authenticated_client()
    account_id = _account_id(client)

    try:
        result = client.get(
            f"user/{client.user_id}/monetary-account/{account_id}/bunqme-tab-result-response/{object_id}"
        )
    except (httpx.HTTPError, BunqClientError) as exc:
        raise BunqUpstreamError(f"bunq callback resolution failed: {exc}") from exc

    result_object = _extract_first_nested_object(result)
    tab_id = result_object.get("bunq_me_tab_id") or result_object.get("bunqme_tab_id")
    if tab_id in (None, ""):
        raise BunqUpstreamError("bunq callback result did not contain bunq_me_tab_id")

    amount_cents = _extract_amount_cents(result_object)
    event_id = f"{category}:{object_id}"
    resolved_payload = {
        "notification": notification,
        "resolved_result": result_object,
        "resolved_reference": f"bunqme-tab:{tab_id}",
    }

    return BunqResolvedPaymentEvent(
        reference=f"bunqme-tab:{tab_id}",
        status=PaymentStatus.paid,
        amount_cents=amount_cents,
        event_id=event_id,
        payload=resolved_payload,
    )


def _authenticated_client() -> BunqClient:
    if not settings.bunq_api_key:
        raise BunqConfigurationError("BUNQ_API_KEY is not configured")
    try:
        client = BunqClient(
            api_key=settings.bunq_api_key,
            sandbox=settings.bunq_sandbox,
            context_file=settings.bunq_context_file,
            user_agent="flashdrop-api/1.0",
            timeout_seconds=settings.bunq_timeout_seconds,
        )
        client.authenticate()
        return client
    except BunqClientDependencyError as exc:
        raise BunqConfigurationError(str(exc)) from exc
    except (httpx.HTTPError, BunqClientError) as exc:
        raise BunqUpstreamError(f"bunq authentication failed: {exc}") from exc


def _account_id(client: BunqClient) -> int:
    return settings.bunq_monetary_account_id or client.get_primary_account_id()


def _format_amount(amount_cents: int) -> str:
    return f"{amount_cents / 100:.2f}"


def _redirect_url(drop_slug: str) -> str | None:
    base = settings.bunq_redirect_base_url.rstrip("/")
    if not base:
        return None
    return f"{base}/drop/{drop_slug}"


def _extract_notification(payload: dict[str, Any]) -> dict[str, Any]:
    if isinstance(payload.get("NotificationUrl"), dict):
        return payload["NotificationUrl"]
    if isinstance(payload.get("notification_url"), dict):
        return payload["notification_url"]
    return payload


def _extract_first_nested_object(response: list[dict[str, Any]]) -> dict[str, Any]:
    if not response:
        raise BunqUpstreamError("bunq response was empty")
    first = response[0]
    if not isinstance(first, dict) or not first:
        raise BunqUpstreamError("bunq response object was malformed")
    return next(iter(first.values()))


def _extract_amount_cents(result_object: dict[str, Any]) -> int | None:
    amount_candidates = [
        result_object.get("amount"),
        result_object.get("amount_inquired"),
    ]
    tab_entries = result_object.get("bunqme_tab_entries")
    if isinstance(tab_entries, list) and tab_entries:
        first_entry = tab_entries[0]
        if isinstance(first_entry, dict):
            amount_candidates.append(first_entry.get("amount_inquired"))

    for amount in amount_candidates:
        if not isinstance(amount, dict):
            continue
        value = amount.get("value")
        if value in (None, ""):
            continue
        try:
            return int(round(float(str(value)) * 100))
        except ValueError:
            continue
    return None
