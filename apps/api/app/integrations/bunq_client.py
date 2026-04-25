from __future__ import annotations

import base64
import json
import uuid
from pathlib import Path
from typing import Any

import httpx

try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding, rsa
except ImportError as exc:  # pragma: no cover - dependency guard
    hashes = None
    serialization = None
    padding = None
    rsa = None
    _CRYPTOGRAPHY_IMPORT_ERROR = exc
else:
    _CRYPTOGRAPHY_IMPORT_ERROR = None


SANDBOX_BASE_URL = "https://public-api.sandbox.bunq.com"
PRODUCTION_BASE_URL = "https://api.bunq.com"
API_VERSION = "v1"


class BunqClientError(Exception):
    pass


class BunqClientDependencyError(BunqClientError):
    pass


class BunqClient:
    def __init__(
        self,
        *,
        api_key: str,
        sandbox: bool,
        context_file: str,
        user_agent: str,
        timeout_seconds: float,
    ) -> None:
        if _CRYPTOGRAPHY_IMPORT_ERROR is not None:
            raise BunqClientDependencyError(
                "cryptography is required for bunq authentication; install backend requirements"
            ) from _CRYPTOGRAPHY_IMPORT_ERROR

        self.api_key = api_key.strip()
        self.sandbox = sandbox
        self.base_url = SANDBOX_BASE_URL if sandbox else PRODUCTION_BASE_URL
        self.context_file = Path(context_file)
        self.user_agent = user_agent
        self.timeout_seconds = timeout_seconds

        self.installation_token: str | None = None
        self.server_public_key: str | None = None
        self.session_token: str | None = None
        self.user_id: int | None = None

        self._private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self._public_key_pem = self._private_key.public_key().public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode()

    @staticmethod
    def create_sandbox_user(*, user_agent: str, timeout_seconds: float) -> str:
        response = httpx.post(
            f"{SANDBOX_BASE_URL}/{API_VERSION}/sandbox-user-person",
            headers={
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
                "User-Agent": user_agent,
                "X-Bunq-Client-Request-Id": str(uuid.uuid4()),
                "X-Bunq-Language": "en_US",
                "X-Bunq-Region": "nl_NL",
                "X-Bunq-Geolocation": "0 0 0 0 000",
            },
            timeout=timeout_seconds,
            trust_env=False,
        )
        response.raise_for_status()
        payload = response.json()
        return payload["Response"][0]["ApiKey"]["api_key"]

    def authenticate(self) -> None:
        if self._load_context() and self._test_session():
            return

        self._step1_installation()
        self._step2_device_server()
        self._step3_session_server()
        self._save_context()

    def get(self, endpoint: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return self._request("GET", endpoint, params=params)

    def post(self, endpoint: str, body: dict[str, Any]) -> list[dict[str, Any]]:
        return self._request("POST", endpoint, body=body)

    def get_primary_account_id(self) -> int:
        response = self.get(f"user/{self.user_id}/monetary-account-bank")
        for item in response:
            account = item.get("MonetaryAccountBank", {})
            if account.get("status") == "ACTIVE":
                return int(account["id"])
        raise BunqClientError("no active monetary account found")

    def _test_session(self) -> bool:
        try:
            self.get(f"user/{self.user_id}")
            return True
        except httpx.HTTPError:
            return False

    def _step1_installation(self) -> None:
        response = self._raw_post("installation", {"client_public_key": self._public_key_pem}, auth_token=None)
        for item in response:
            if "Token" in item:
                self.installation_token = item["Token"]["token"]
            if "ServerPublicKey" in item:
                self.server_public_key = item["ServerPublicKey"]["server_public_key"]

    def _step2_device_server(self) -> None:
        self._raw_post(
            "device-server",
            {
                "description": self.user_agent,
                "secret": self.api_key,
                "permitted_ips": ["*"],
            },
            auth_token=self.installation_token,
        )

    def _step3_session_server(self) -> None:
        response = self._raw_post(
            "session-server",
            {"secret": self.api_key},
            auth_token=self.installation_token,
        )
        for item in response:
            if "Token" in item:
                self.session_token = item["Token"]["token"]
            if "UserPerson" in item:
                self.user_id = int(item["UserPerson"]["id"])
            if "UserCompany" in item:
                self.user_id = int(item["UserCompany"]["id"])
            if "UserApiKey" in item:
                self.user_id = int(item["UserApiKey"]["id"])

    def _request(
        self,
        method: str,
        endpoint: str,
        *,
        body: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        url = f"{self.base_url}/{API_VERSION}/{endpoint}"
        headers = self._build_headers(body)

        with httpx.Client(timeout=self.timeout_seconds, trust_env=False) as client:
            response = client.request(method, url, headers=headers, json=body, params=params)
            response.raise_for_status()
            payload = response.json()
        return payload.get("Response", [])

    def _raw_post(
        self,
        endpoint: str,
        body: dict[str, Any],
        *,
        auth_token: str | None,
    ) -> list[dict[str, Any]]:
        url = f"{self.base_url}/{API_VERSION}/{endpoint}"
        body_bytes = json.dumps(body).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "User-Agent": self.user_agent,
            "X-Bunq-Client-Request-Id": str(uuid.uuid4()),
            "X-Bunq-Language": "en_US",
            "X-Bunq-Region": "nl_NL",
            "X-Bunq-Geolocation": "0 0 0 0 000",
            "X-Bunq-Client-Signature": self._sign(body_bytes),
        }
        if auth_token:
            headers["X-Bunq-Client-Authentication"] = auth_token

        with httpx.Client(timeout=self.timeout_seconds, trust_env=False) as client:
            response = client.post(url, headers=headers, content=body_bytes)
            response.raise_for_status()
            payload = response.json()
        return payload.get("Response", [])

    def _build_headers(self, body: dict[str, Any] | None = None) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "User-Agent": self.user_agent,
            "X-Bunq-Client-Authentication": self.session_token or "",
            "X-Bunq-Client-Request-Id": str(uuid.uuid4()),
            "X-Bunq-Language": "en_US",
            "X-Bunq-Region": "nl_NL",
            "X-Bunq-Geolocation": "0 0 0 0 000",
        }
        if body is not None:
            headers["X-Bunq-Client-Signature"] = self._sign(json.dumps(body).encode("utf-8"))
        return headers

    def _sign(self, body_bytes: bytes) -> str:
        signature = self._private_key.sign(
            body_bytes,
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        return base64.b64encode(signature).decode()

    def _save_context(self) -> None:
        self.context_file.parent.mkdir(parents=True, exist_ok=True)
        context = {
            "api_key": self.api_key,
            "sandbox": self.sandbox,
            "private_key_pem": self._private_key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            ).decode(),
            "installation_token": self.installation_token,
            "server_public_key": self.server_public_key,
            "session_token": self.session_token,
            "user_id": self.user_id,
        }
        self.context_file.write_text(json.dumps(context, indent=2), encoding="utf-8")

    def _load_context(self) -> bool:
        if not self.context_file.exists():
            return False
        try:
            context = json.loads(self.context_file.read_text(encoding="utf-8"))
            if context.get("api_key") != self.api_key or context.get("sandbox") != self.sandbox:
                return False
            self._private_key = serialization.load_pem_private_key(
                context["private_key_pem"].encode(),
                password=None,
            )
            self._public_key_pem = self._private_key.public_key().public_bytes(
                serialization.Encoding.PEM,
                serialization.PublicFormat.SubjectPublicKeyInfo,
            ).decode()
            self.installation_token = context["installation_token"]
            self.server_public_key = context["server_public_key"]
            self.session_token = context["session_token"]
            self.user_id = int(context["user_id"])
            return True
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            return False
