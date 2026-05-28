import json
import sys
import unittest
from pathlib import Path


SRC_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SRC_DIR))

from core.config import Config  # noqa: E402
from utils.setup_bundle import apply_setup_bundle_to_config, parse_setup_bundle  # noqa: E402


class SetupBundleTest(unittest.TestCase):
    def sample_bundle(self):
        return {
            "type": "clipcascade-setup-v1",
            "serverUrl": "https://aiostreams-egress.tail94fa2c.ts.net/",
            "username": "admin",
            "apiKey": "cck_device",
            "clientId": "client-123",
            "clientName": "Windows laptop",
            "scopes": ["sync"],
            "cipherEnabled": True,
            "encryptionMode": "sync_key",
            "syncEncryptionKey": "ccsk_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        }

    def test_parse_setup_bundle_validates_expected_type(self):
        bundle = self.sample_bundle()

        parsed = parse_setup_bundle(json.dumps(bundle))

        self.assertEqual(parsed["type"], "clipcascade-setup-v1")
        self.assertEqual(parsed["apiKey"], "cck_device")

    def test_apply_setup_bundle_sets_api_key_and_sync_encryption_key(self):
        config = Config()

        apply_setup_bundle_to_config(config, json.dumps(self.sample_bundle()))

        self.assertEqual(
            config.data["server_url"], "https://aiostreams-egress.tail94fa2c.ts.net"
        )
        self.assertEqual(config.data["username"], "admin")
        self.assertEqual(config.data["api_key"], "cck_device")
        self.assertEqual(config.data["api_client_id"], "client-123")
        self.assertEqual(config.data["api_client_name"], "Windows laptop")
        self.assertEqual(
            config.data["sync_encryption_key"],
            "ccsk_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        )
        self.assertTrue(config.data["cipher_enabled"])
        self.assertEqual(config.data["password"], "")
        self.assertIsNone(config.data["hashed_password"])

    def test_parse_rejects_bundle_without_sync_key_when_mode_requires_it(self):
        bundle = self.sample_bundle()
        bundle["syncEncryptionKey"] = ""

        with self.assertRaises(ValueError):
            parse_setup_bundle(json.dumps(bundle))


if __name__ == "__main__":
    unittest.main()
