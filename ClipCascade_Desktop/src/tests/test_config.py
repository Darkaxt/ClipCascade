import sys
import unittest
from pathlib import Path


SRC_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SRC_DIR))

from core.config import Config  # noqa: E402


class ConfigWebSocketUrlTest(unittest.TestCase):
    def test_default_config_has_sync_encryption_key_slot(self):
        config = Config()

        self.assertIn("sync_encryption_key", config.data)
        self.assertEqual(config.data["sync_encryption_key"], "")

    def test_normalizes_stale_https_websocket_url_for_p2s(self):
        data = {
            "server_url": "https://aiostreams-egress.tail94fa2c.ts.net",
            "websocket_url": "https://aiostreams-egress.tail94fa2c.ts.net/clipsocket",
            "server_mode": "P2S",
        }

        changed = Config.normalize_websocket_url(data)

        self.assertTrue(changed)
        self.assertEqual(
            data["websocket_url"],
            "wss://aiostreams-egress.tail94fa2c.ts.net/clipsocket",
        )

    def test_normalizes_stale_http_websocket_url_for_p2p(self):
        data = {
            "server_url": "http://clipcascade.example.test",
            "websocket_url": "http://clipcascade.example.test/clipsocket",
            "server_mode": "P2P",
        }

        changed = Config.normalize_websocket_url(data)

        self.assertTrue(changed)
        self.assertEqual(data["websocket_url"], "ws://clipcascade.example.test/p2psignaling")

    def test_keeps_valid_websocket_url(self):
        data = {
            "server_url": "https://clipcascade.example.test",
            "websocket_url": "wss://clipcascade.example.test/clipsocket",
            "server_mode": "P2S",
        }

        changed = Config.normalize_websocket_url(data)

        self.assertFalse(changed)
        self.assertEqual(data["websocket_url"], "wss://clipcascade.example.test/clipsocket")


if __name__ == "__main__":
    unittest.main()
