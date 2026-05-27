import unittest
from unittest.mock import patch

from core.config import Config
from clipboard.clipboard_manager import ClipboardManager
from stomp_ws.stomp_manager import STOMPManager


class InvalidSessionRequestManager:
    def __init__(self, config):
        self.config = config

    def validate_session(self):
        return False


class STOMPManagerSessionTests(unittest.TestCase):
    def test_connect_stops_before_websocket_when_saved_session_expired(self):
        config = Config()
        config.data.update(
            {
                "server_url": "https://clipcascade.example.test",
                "websocket_url": "wss://clipcascade.example.test/clipsocket",
                "cookie": {"JSESSIONID": "expired"},
            }
        )

        with (
            patch("stomp_ws.stomp_manager.RequestManager", InvalidSessionRequestManager),
            patch("stomp_ws.stomp_manager.Client") as mock_client,
            patch.object(ClipboardManager, "on_copy"),
            self.assertLogs(level="ERROR") as logs,
        ):
            manager = STOMPManager(config, is_login_phase=False)
            success, message = manager.connect()

        self.assertFalse(success)
        self.assertIn("Session expired", message)
        self.assertTrue(any("Session expired" in line for line in logs.output))
        self.assertTrue(manager.disconnected)
        mock_client.assert_not_called()


if __name__ == "__main__":
    unittest.main()
