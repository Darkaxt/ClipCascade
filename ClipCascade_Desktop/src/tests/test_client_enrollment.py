import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


SRC_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SRC_DIR))

from core.config import Config  # noqa: E402
from utils.cipher_manager import CipherManager  # noqa: E402
from utils.client_enrollment import (  # noqa: E402
    encode_sync_encryption_key,
    enroll_client,
    unwrap_sync_encryption_key,
    wrap_sync_encryption_key,
)


class DummyResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code
        self.text = json.dumps(payload)

    def json(self):
        return self.payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class ClientEnrollmentTest(unittest.TestCase):
    def test_wrapped_sync_key_round_trips_without_plaintext_key(self):
        sync_key = encode_sync_encryption_key(b"\x11" * 32)

        wrapped = wrap_sync_encryption_key("account-password", sync_key)
        unwrapped = unwrap_sync_encryption_key("account-password", wrapped)

        self.assertEqual(unwrapped, sync_key)
        self.assertEqual("pbkdf2-sha256-aes-gcm-v1", wrapped["version"])
        self.assertNotIn(sync_key, json.dumps(wrapped))

    def test_enroll_client_stores_returned_existing_sync_key_and_api_key(self):
        config = Config()
        config.data["server_url"] = "https://clipcascade.example.test/"
        config.data["username"] = "admin"
        remote_sync_key = encode_sync_encryption_key(b"\x22" * 32)
        remote_wrap = wrap_sync_encryption_key("account-password", remote_sync_key)
        posted_payload = {}

        def fake_post(url, json=None, **kwargs):
            posted_payload.update(json)
            return DummyResponse(
                {
                    "username": "admin",
                    "clientId": "client-123",
                    "clientName": "Windows laptop",
                    "apiKey": "cck_device",
                    "scopes": ["sync"],
                    "syncKeyStatus": "existing",
                    "keyWrap": remote_wrap,
                }
            )

        with patch("utils.client_enrollment.requests.post", side_effect=fake_post):
            enroll_client(config, "account-password", "Windows laptop")

        self.assertEqual(config.data["api_key"], "cck_device")
        self.assertEqual(config.data["api_client_id"], "client-123")
        self.assertEqual(config.data["api_client_name"], "Windows laptop")
        self.assertEqual(config.data["sync_encryption_key"], remote_sync_key)
        self.assertTrue(config.data["cipher_enabled"])
        self.assertEqual(config.data["password"], "")
        self.assertEqual(config.data["csrf_token"], "")
        self.assertIsNone(config.data["cookie"])
        self.assertIsNone(config.data["hashed_password"])
        self.assertEqual(
            posted_payload["passwordHash"],
            CipherManager.string_to_sha3_512_lowercase_hex("account-password"),
        )
        self.assertNotIn(remote_sync_key, json.dumps(posted_payload["keyWrap"]))


if __name__ == "__main__":
    unittest.main()
