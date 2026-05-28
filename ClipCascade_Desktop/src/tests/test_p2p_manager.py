import unittest
from unittest.mock import patch

from core.config import Config
from clipboard.clipboard_manager import ClipboardManager
from p2p.p2p_manager import P2PManager


class InvalidSessionRequestManager:
    def __init__(self, config):
        self.config = config

    def validate_session_result(self):
        from utils.request_manager import SessionValidationResult

        return SessionValidationResult(
            valid=False,
            reason="server redirected to login",
            http_status=302,
            location="https://clipcascade.example.test/login",
        )


class P2PManagerSessionTests(unittest.TestCase):
    def test_connect_stops_before_signaling_socket_when_saved_session_invalid(self):
        config = Config()
        config.data.update(
            {
                "server_url": "https://clipcascade.example.test",
                "websocket_url": "wss://clipcascade.example.test/p2psignaling",
                "cookie": {"JSESSIONID": "expired"},
            }
        )

        with (
            patch("p2p.p2p_manager.RequestManager", InvalidSessionRequestManager),
            patch("p2p.p2p_manager.websocket.WebSocketApp") as mock_socket,
            patch.object(ClipboardManager, "stop") as mock_stop,
            patch.object(Config, "save"),
            patch("p2p.p2p_manager.NotificationManager.notify"),
            self.assertLogs(level="ERROR") as logs,
        ):
            manager = P2PManager(config, is_login_phase=False)
            manager.is_clipboard_monitoring_on = True
            try:
                success, message = manager.connect()
            finally:
                manager.loop.call_soon_threadsafe(manager.loop.stop)

        self.assertFalse(success)
        self.assertIn("Saved login no longer valid", message)
        self.assertTrue(any("HTTP 302" in line for line in logs.output))
        self.assertFalse(manager.is_clipboard_monitoring_on)
        mock_stop.assert_called_once()
        mock_socket.assert_not_called()


if __name__ == "__main__":
    unittest.main()
