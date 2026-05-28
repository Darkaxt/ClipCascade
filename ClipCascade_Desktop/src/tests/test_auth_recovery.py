import sys
import unittest
from pathlib import Path


SRC_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SRC_DIR))

from utils.auth_recovery import clear_rejected_api_auth  # noqa: E402


class AuthRecoveryTest(unittest.TestCase):
    def test_clear_rejected_api_auth_removes_only_login_credentials(self):
        data = {
            "api_key": "cck_stale",
            "api_client_id": "client-123",
            "api_client_name": "Windows laptop",
            "cookie": {"SESSION": "old"},
            "csrf_token": "csrf",
            "hashed_password": b"legacy",
            "sync_encryption_key": "ccsk_keep",
            "server_url": "https://clipcascade.example.test",
            "username": "admin",
        }

        changed = clear_rejected_api_auth(data)

        self.assertTrue(changed)
        self.assertEqual(data["api_key"], "")
        self.assertEqual(data["api_client_id"], "")
        self.assertEqual(data["api_client_name"], "")
        self.assertIsNone(data["cookie"])
        self.assertEqual(data["csrf_token"], "")
        self.assertIsNone(data["hashed_password"])
        self.assertEqual(data["sync_encryption_key"], "ccsk_keep")
        self.assertEqual(data["server_url"], "https://clipcascade.example.test")
        self.assertEqual(data["username"], "admin")

    def test_clear_rejected_api_auth_noops_without_api_key(self):
        data = {"api_key": "", "cookie": {"SESSION": "old"}}

        changed = clear_rejected_api_auth(data)

        self.assertFalse(changed)
        self.assertEqual(data["cookie"], {"SESSION": "old"})


if __name__ == "__main__":
    unittest.main()
