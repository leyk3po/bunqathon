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


@dataclass(frozen=True)
class BunqAccountBalance:
    account_id: int
    description: str
    balance_cents: int
    currency: str
    iban: str | None


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
    tab_reference: str | None = None
    amount_cents: int | None = None
    resolved_result: dict[str, Any] = {}

    try:
        result = client.get(
            f"user/{client.user_id}/monetary-account/{account_id}/bunqme-tab-result-response/{object_id}"
        )
    except (httpx.HTTPError, BunqClientError) as exc:
        raise BunqUpstreamError(f"bunq callback resolution failed: {exc}") from exc

    result_object = _extract_first_nested_object(result)
    resolved_result = result_object
    tab_reference = _reference_from_result_object(result_object)
    amount_cents = _amount_from_result_object(result_object)

    if tab_reference is None:
        try:
            tab = client.get(
                f"user/{client.user_id}/monetary-account/{account_id}/bunqme-tab/{object_id}"
            )
        except (httpx.HTTPError, BunqClientError) as exc:
            raise BunqUpstreamError(f"bunq callback resolution failed: {exc}") from exc

        tab_object = _extract_first_nested_object(tab)
        resolved_result = tab_object
        tab_reference = _reference_from_tab_object(tab_object)
        amount_cents = _amount_from_tab_object(tab_object)

    if tab_reference is None:
        raise BunqUpstreamError(
            "bunq callback result could not be mapped to a bunq.me tab reference"
        )

    event_id = f"{category}:{object_id}"
    resolved_payload = {
        "notification": notification,
        "resolved_result": resolved_result,
        "resolved_reference": tab_reference,
    }

    return BunqResolvedPaymentEvent(
        reference=tab_reference,
        status=PaymentStatus.paid,
        amount_cents=amount_cents,
        event_id=event_id,
        payload=resolved_payload,
    )


def fetch_account_balance() -> BunqAccountBalance:
    client = _authenticated_client()
    account_id = _account_id(client)
    try:
        response = client.get(f"user/{client.user_id}/monetary-account/{account_id}")
    except (httpx.HTTPError, BunqClientError) as exc:
        raise BunqUpstreamError(f"bunq balance fetch failed: {exc}") from exc

    account_obj: dict[str, Any] = {}
    for item in response or []:
        for key, value in item.items():
            if isinstance(value, dict) and key.startswith("MonetaryAccount"):
                account_obj = value
                break
        if account_obj:
            break

    balance = account_obj.get("balance") or {}
    raw_value = balance.get("value")
    currency = str(balance.get("currency") or "EUR")
    try:
        balance_cents = int(round(float(raw_value) * 100)) if raw_value is not None else 0
    except (TypeError, ValueError):
        balance_cents = 0

    description = str(account_obj.get("description") or "Main account")

    iban: str | None = None
    aliases = account_obj.get("alias")
    if isinstance(aliases, list):
        for alias in aliases:
            if isinstance(alias, dict) and alias.get("type") == "IBAN":
                iban = str(alias.get("value") or "") or None
                break

    return BunqAccountBalance(
        account_id=account_id,
        description=description,
        balance_cents=balance_cents,
        currency=currency,
        iban=iban,
    )


def _authenticated_client() -> BunqClient:
    if not settings.bunq_api_key:
        raise BunqConfigurationError("BUNQ_API_KEY is not configured")
    try:
        client = BunqClient(
            api_key=settings.bunq_api_key,
            sandbox=settings.bunq_sandbox,
            context_file=settings.bunq_context_file,
            permitted_ips=settings.bunq_permitted_ips,
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


def _reference_from_result_object(result_object: dict[str, Any]) -> str | None:
    tab_id = result_object.get("bunq_me_tab_id") or result_object.get("bunqme_tab_id")
    if tab_id not in (None, ""):
        return f"bunqme-tab:{tab_id}"

    payment = result_object.get("payment")
    if isinstance(payment, dict):
        merchant_reference = str(payment.get("merchant_reference") or "").strip()
        if merchant_reference:
            return merchant_reference
    return None


def _reference_from_tab_object(tab_object: dict[str, Any]) -> str | None:
    result_inquiries = tab_object.get("result_inquiries")
    if isinstance(result_inquiries, list):
        for item in reversed(result_inquiries):
            if not isinstance(item, dict):
                continue
            tab_id = item.get("bunq_me_tab_id") or item.get("bunqme_tab_id")
            if tab_id not in (None, ""):
                return f"bunqme-tab:{tab_id}"
            payment = item.get("payment")
            if isinstance(payment, dict):
                merchant_reference = str(payment.get("merchant_reference") or "").strip()
                if merchant_reference:
                    return merchant_reference

    tab_id = tab_object.get("id")
    if tab_id not in (None, ""):
        return f"bunqme-tab:{tab_id}"
    return None


def _amount_from_result_object(result_object: dict[str, Any]) -> int | None:
    amount_cents = _extract_amount_cents(result_object)
    if amount_cents is not None:
        return amount_cents

    payment = result_object.get("payment")
    if isinstance(payment, dict):
        return _extract_amount_cents({"amount": payment.get("amount")})
    return None


def _amount_from_tab_object(tab_object: dict[str, Any]) -> int | None:
    result_inquiries = tab_object.get("result_inquiries")
    if isinstance(result_inquiries, list):
        for item in reversed(result_inquiries):
            if not isinstance(item, dict):
                continue
            payment = item.get("payment")
            if isinstance(payment, dict):
                amount_cents = _extract_amount_cents({"amount": payment.get("amount")})
                if amount_cents is not None:
                    return amount_cents

    entry = tab_object.get("bunqme_tab_entry")
    if isinstance(entry, dict):
        return _extract_amount_cents({"amount_inquired": entry.get("amount_inquired")})
    return None
