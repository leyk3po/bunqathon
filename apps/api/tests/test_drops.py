from __future__ import annotations

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.database import Base, get_db, register_models
from app.drops.models import Drop
from app.integrations.bunq import BunqTab
from app.integrations.ai import Generated
from app.main import create_app


class DropLifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        register_models()
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

        self.app = create_app()

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        self.app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(self.app)

    def tearDown(self) -> None:
        self.client.close()
        self.engine.dispose()

    def _register_seller(self, email: str = "seller@example.com") -> dict:
        response = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "display_name": "Seller Booth",
                "password": "supersecret123",
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def _auth_headers(self, auth: dict) -> dict[str, str]:
        return {"Authorization": f"Bearer {auth['access_token']}"}

    def _create_drop(self, auth: dict, *, inventory: int = 2, price_cents: int = 1200) -> dict:
        response = self.client.post(
            "/api/v1/drops",
            headers=self._auth_headers(auth),
            json={
                "title": "Campus Tote",
                "description": "Student-made tote",
                "price_cents": price_cents,
                "inventory": inventory,
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def test_publishes_directly_from_draft(self) -> None:
        auth = self._register_seller()
        drop = self._create_drop(auth)

        with patch(
            "app.drops.service.bunq.create_bunqme_tab",
            return_value=BunqTab(
                uuid="tab-123",
                share_url="https://bunq.me/flashdrop/test",
                payment_reference="bunqme-tab:123",
            ),
        ):
            published = self.client.post(
                f"/api/v1/drops/{drop['id']}/publish",
                headers=self._auth_headers(auth),
            )

        self.assertEqual(published.status_code, 200)
        body = published.json()
        self.assertEqual(body["state"], "live")
        self.assertEqual(body["bunq_tab_url"], "https://bunq.me/flashdrop/test")
        self.assertEqual(body["payments"], [])

    def test_generate_preview_returns_inventory(self) -> None:
        with patch(
            "app.drops.router.ai.generate_drop_copy",
            return_value=Generated(
                title="Coca-Cola Can",
                description="Single cold can, sold one by one.",
                price_cents=100,
                currency="EUR",
                inventory=10,
            ),
        ):
            response = self.client.post(
                "/api/v1/drops/generate-preview",
                json={
                    "pitch": "I have 10 cans for one euro each and want to sell them separately.",
                    "media_url": None,
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["inventory"], 10)
        self.assertEqual(body["price_cents"], 100)

    def test_counts_distinct_payment_events_until_sold_out(self) -> None:
        auth = self._register_seller("payments@example.com")
        drop = self._create_drop(auth, inventory=2, price_cents=1500)

        with patch(
            "app.drops.service.bunq.create_bunqme_tab",
            return_value=BunqTab(
                uuid="tab-456",
                share_url="https://bunq.me/flashdrop/payments",
                payment_reference="bunqme-tab:456",
            ),
        ):
            published = self.client.post(
                f"/api/v1/drops/{drop['id']}/publish",
                headers=self._auth_headers(auth),
            )

        self.assertEqual(published.status_code, 200)

        first_payment = self.client.post(
            "/api/v1/webhooks/bunq",
            json={
                "event_id": "evt-1",
                "reference": "bunqme-tab:456",
                "amount_cents": 1500,
                "status": "paid",
            },
        )
        self.assertEqual(first_payment.status_code, 200)
        self.assertEqual(first_payment.json()["drop_state"], "live")

        second_payment = self.client.post(
            "/api/v1/webhooks/bunq",
            json={
                "event_id": "evt-2",
                "reference": "bunqme-tab:456",
                "amount_cents": 1500,
                "status": "paid",
            },
        )
        self.assertEqual(second_payment.status_code, 200)
        self.assertEqual(second_payment.json()["drop_state"], "sold_out")

        duplicate_payment = self.client.post(
            "/api/v1/webhooks/bunq",
            json={
                "event_id": "evt-2",
                "reference": "bunqme-tab:456",
                "amount_cents": 1500,
                "status": "paid",
            },
        )
        self.assertEqual(duplicate_payment.status_code, 200)
        self.assertEqual(duplicate_payment.json()["drop_state"], "sold_out")

        fetched = self.client.get(f"/api/v1/drops/{published.json()['slug']}")
        self.assertEqual(fetched.status_code, 200)
        body = fetched.json()
        self.assertEqual(body["state"], "sold_out")
        self.assertEqual(body["inventory"], 0)
        self.assertEqual(body["sold_count"], 2)
        self.assertEqual(len(body["payments"]), 2)
        self.assertEqual([payment["status"] for payment in body["payments"]], ["paid", "paid"])

    def test_expired_drop_is_archived_and_cannot_be_published(self) -> None:
        auth = self._register_seller("expiry@example.com")
        future = datetime.now(timezone.utc) + timedelta(minutes=30)
        created = self.client.post(
            "/api/v1/drops",
            headers=self._auth_headers(auth),
            json={
                "title": "Limited Soda",
                "description": "Expires soon",
                "price_cents": 100,
                "inventory": 10,
                "expires_at": future.isoformat(),
            },
        )
        self.assertEqual(created.status_code, 201)
        drop = created.json()

        with self.SessionLocal() as db:
            model = db.get(Drop, drop["id"])
            model.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
            db.commit()

        fetched = self.client.get(f"/api/v1/drops/{drop['slug']}")
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(fetched.json()["state"], "archived")

        publish = self.client.post(
            f"/api/v1/drops/{drop['id']}/publish",
            headers=self._auth_headers(auth),
        )
        self.assertEqual(publish.status_code, 409)


if __name__ == "__main__":
    unittest.main()
