from __future__ import annotations

import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.database import Base, get_db, register_models
from app.main import create_app


class SellerAuthTests(unittest.TestCase):
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

    def test_register_login_and_me(self) -> None:
        register_response = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": "seller@example.com",
                "display_name": "Campus Table",
                "password": "supersecret123",
            },
        )
        self.assertEqual(register_response.status_code, 201)
        register_body = register_response.json()
        self.assertIn("access_token", register_body)
        self.assertEqual(register_body["seller"]["display_name"], "Campus Table")

        login_response = self.client.post(
            "/api/v1/auth/login",
            json={
                "email": "seller@example.com",
                "password": "supersecret123",
            },
        )
        self.assertEqual(login_response.status_code, 200)
        token = login_response.json()["access_token"]

        me_response = self.client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.json()["email"], "seller@example.com")

    def test_create_drop_requires_auth_and_uses_authenticated_seller(self) -> None:
        unauthenticated = self.client.post(
            "/api/v1/drops",
            json={
                "title": "No Auth Drop",
                "description": "blocked",
                "price_cents": 900,
                "inventory": 1,
            },
        )
        self.assertEqual(unauthenticated.status_code, 401)

        auth = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": "owner@example.com",
                "display_name": "Owner Booth",
                "password": "supersecret123",
            },
        ).json()

        created = self.client.post(
            "/api/v1/drops",
            headers={"Authorization": f"Bearer {auth['access_token']}"},
            json={
                "title": "Owner Drop",
                "description": "seller-owned",
                "price_cents": 1200,
                "inventory": 3,
                "seller_id": "spoofed-client-seller",
            },
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["seller_id"], auth["seller"]["id"])

    def test_listing_query_is_limited_to_authenticated_seller(self) -> None:
        first = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": "first@example.com",
                "display_name": "First Booth",
                "password": "supersecret123",
            },
        ).json()
        second = self.client.post(
            "/api/v1/auth/register",
            json={
                "email": "second@example.com",
                "display_name": "Second Booth",
                "password": "supersecret123",
            },
        ).json()

        self.client.post(
            "/api/v1/drops",
            headers={"Authorization": f"Bearer {first['access_token']}"},
            json={
                "title": "First Drop",
                "description": "seller-owned",
                "price_cents": 1200,
                "inventory": 2,
            },
        )

        forbidden = self.client.get(
            f"/api/v1/drops?seller_id={first['seller']['id']}",
            headers={"Authorization": f"Bearer {second['access_token']}"},
        )
        self.assertEqual(forbidden.status_code, 403)

        own = self.client.get(
            f"/api/v1/drops?seller_id={first['seller']['id']}",
            headers={"Authorization": f"Bearer {first['access_token']}"},
        )
        self.assertEqual(own.status_code, 200)
        self.assertEqual(len(own.json()), 1)


if __name__ == "__main__":
    unittest.main()
