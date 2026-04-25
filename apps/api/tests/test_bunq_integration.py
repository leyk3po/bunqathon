from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.integrations import bunq


class _FakeClient:
    def __init__(self, responses: dict[str, list[dict]]) -> None:
        self.responses = responses
        self.user_id = 123

    def get_primary_account_id(self) -> int:
        return 456

    def get(self, endpoint: str) -> list[dict]:
        try:
            return self.responses[endpoint]
        except KeyError as exc:  # pragma: no cover - defensive test guard
            raise AssertionError(f"unexpected endpoint {endpoint}") from exc


class BunqWebhookResolutionTests(unittest.TestCase):
    def test_resolves_reference_from_result_response_shape(self) -> None:
        client = _FakeClient(
            {
                "user/123/monetary-account/456/bunqme-tab-result-response/999": [
                    {
                        "TabResultResponse": {
                            "payment": {
                                "amount": {"value": "5.00", "currency": "EUR"},
                            },
                            "bunq_me_tab_id": 15746,
                        }
                    }
                ]
            }
        )

        with patch("app.integrations.bunq._authenticated_client", return_value=client):
            resolved = bunq.resolve_payment_callback(
                {"NotificationUrl": {"category": "TAB_RESULT", "object_id": 999}}
            )

        self.assertEqual(resolved.reference, "bunqme-tab:15746")
        self.assertEqual(resolved.amount_cents, 500)

    def test_falls_back_to_tab_shape_when_result_response_lacks_tab_id(self) -> None:
        client = _FakeClient(
            {
                "user/123/monetary-account/456/bunqme-tab-result-response/15746": [
                    {
                        "TabResultResponse": {
                            "payment": {
                                "amount": {"value": "5.00", "currency": "EUR"},
                            }
                        }
                    }
                ],
                "user/123/monetary-account/456/bunqme-tab/15746": [
                    {
                        "BunqMeTab": {
                            "id": 15746,
                            "bunqme_tab_entry": {
                                "amount_inquired": {"value": "5.00", "currency": "EUR"}
                            },
                            "result_inquiries": [
                                {
                                    "payment": {
                                        "amount": {"value": "5.00", "currency": "EUR"},
                                    },
                                    "bunq_me_tab_id": 15746,
                                }
                            ],
                        }
                    }
                ],
            }
        )

        with patch("app.integrations.bunq._authenticated_client", return_value=client):
            resolved = bunq.resolve_payment_callback(
                {"NotificationUrl": {"category": "TAB_RESULT", "object_id": 15746}}
            )

        self.assertEqual(resolved.reference, "bunqme-tab:15746")
        self.assertEqual(resolved.amount_cents, 500)


if __name__ == "__main__":
    unittest.main()
