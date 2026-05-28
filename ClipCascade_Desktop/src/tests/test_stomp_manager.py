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

    def validate_session_result(self):
        from utils.request_manager import SessionValidationResult

        return SessionValidationResult(
            valid=False,
            reason="server rejected saved login",
            http_status=403,
        )


class SequenceSessionRequestManager:
    def __init__(self, config):
        self.config = config
        self.results = [False, True]

    def validate_session(self):
        return self.results.pop(0)

    def validate_session_result(self):
        from utils.request_manager import SessionValidationResult

        valid = self.results.pop(0)
        return SessionValidationResult(
            valid=valid,
            reason="saved login active" if valid else "server rejected saved login",
            http_status=None if valid else 403,
        )

    @staticmethod
    def format_cookie(cookie):
        return f"JSESSIONID={cookie.get('JSESSIONID', '')};"

    def auth_headers(self):
        return {"Cookie": self.format_cookie(self.config.data.get("cookie") or {})}

    def stomp_headers(self):
        return {}


class FakeClient:
    instances = []

    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs
        self.connect_headers = None
        self.disconnect_called = False
        FakeClient.instances.append(self)

    def connect(self, timeout=0, headers=None, connectCallback=None, errorCallback=None):
        self.connect_headers = headers
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
            patch.object(ClipboardManager, "stop") as mock_stop,
            patch.object(Config, "save"),
            patch("stomp_ws.stomp_manager.NotificationManager.notify") as mock_notify,
            self.assertLogs(level="ERROR") as logs,
        ):
            manager = STOMPManager(config, is_login_phase=False)
            success, message = manager.connect()

        self.assertFalse(success)
        self.assertIn("Saved login no longer valid", message)
        self.assertTrue(any("HTTP 403" in line for line in logs.output))
        mock_notify.assert_called_once()
        self.assertIn("Login Required", mock_notify.call_args.kwargs["title"])
        self.assertTrue(manager.disconnected)
        mock_stop.assert_called_once()
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
        self.assertIn("Saved login no longer valid", first_message)
        self.assertTrue(any("Saved login rejected" in line for line in logs.output))
        self.assertTrue(second_success)
        self.assertEqual("Websocket connected", second_message)
        self.assertFalse(manager.disconnected)
        self.assertFalse(FakeClient.instances[-1].disconnect_called)

    def test_connect_uses_api_key_headers_for_websocket_and_stomp_connect(self):
        FakeClient.instances = []
        config = Config()
        config.data.update(
            {
                "server_url": "https://clipcascade.example.test",
                "websocket_url": "wss://clipcascade.example.test/clipsocket",
                "api_key": "cck_secret",
            }
        )

        with (
            patch("stomp_ws.stomp_manager.Client", FakeClient),
            patch.object(ClipboardManager, "on_copy"),
        ):
            manager = STOMPManager(config, is_login_phase=True)
            success, message = manager.connect()

        self.assertTrue(success)
        self.assertEqual("Websocket connected", message)
        self.assertEqual(
            {"X-ClipCascade-Api-Key": "cck_secret"},
            FakeClient.instances[-1].kwargs["headers"],
        )
        self.assertEqual(
            {"x-clipcascade-api-key": "cck_secret"},
            FakeClient.instances[-1].connect_headers,
        )


if __name__ == "__main__":
    unittest.main()
