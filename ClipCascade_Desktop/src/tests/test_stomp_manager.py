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


class SequenceSessionRequestManager:
    def __init__(self, config):
        self.config = config
        self.results = [False, True]

    def validate_session(self):
        return self.results.pop(0)

    @staticmethod
    def format_cookie(cookie):
        return f"JSESSIONID={cookie.get('JSESSIONID', '')};"


class FakeClient:
    instances = []

    def __init__(self, *args, **kwargs):
        self.disconnect_called = False
        FakeClient.instances.append(self)

    def connect(self, timeout=0, connectCallback=None, errorCallback=None):
        if connectCallback is not None:
            connectCallback(None)

    def subscribe(self, destination, callback=None, headers=None):
        return "sub-0", lambda: None

    def disconnect(self):
        self.disconnect_called = True


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
            patch.object(Config, "save"),
            self.assertLogs(level="ERROR") as logs,
        ):
            manager = STOMPManager(config, is_login_phase=False)
            success, message = manager.connect()

        self.assertFalse(success)
        self.assertIn("Session expired", message)
        self.assertTrue(any("Session expired" in line for line in logs.output))
        self.assertTrue(manager.disconnected)
        mock_client.assert_not_called()

    def test_login_after_expired_session_does_not_self_disconnect(self):
        FakeClient.instances = []
        config = Config()
        config.data.update(
            {
                "server_url": "https://clipcascade.example.test",
                "websocket_url": "wss://clipcascade.example.test/clipsocket",
                "cookie": {"JSESSIONID": "fresh"},
            }
        )

        with (
            patch("stomp_ws.stomp_manager.RequestManager", SequenceSessionRequestManager),
            patch("stomp_ws.stomp_manager.Client", FakeClient),
            patch.object(ClipboardManager, "on_copy"),
            patch.object(Config, "save"),
            self.assertLogs(level="ERROR") as logs,
        ):
            manager = STOMPManager(config, is_login_phase=True)
            first_success, first_message = manager.connect()
            config.data["cookie"] = {"JSESSIONID": "fresh"}
            second_success, second_message = manager.connect()

        self.assertFalse(first_success)
        self.assertIn("Session expired", first_message)
        self.assertTrue(any("Session expired" in line for line in logs.output))
        self.assertTrue(second_success)
        self.assertEqual("Websocket connected", second_message)
        self.assertFalse(manager.disconnected)
        self.assertFalse(FakeClient.instances[-1].disconnect_called)


if __name__ == "__main__":
    unittest.main()
