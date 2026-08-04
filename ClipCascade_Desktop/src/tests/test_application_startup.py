import types
import unittest
from unittest.mock import Mock, patch

from core.application import Application
from utils.request_manager import SessionValidationResult


class SavedAuthRequestManager:
    def __init__(self, validation_result):
        self.validation_result = validation_result

    def validate_session_result(self):
        return self.validation_result

    @staticmethod
    def has_api_key():
        return True


class ApplicationSavedAuthStartupTests(unittest.TestCase):
    def build_application(self, validation_result):
        app = Application.__new__(Application)
        app.config = types.SimpleNamespace(
            data={
                "api_key": "cck_cached",
                "cookie": None,
                "server_mode": "P2S",
            }
        )
        app.request_manager = SavedAuthRequestManager(validation_result)
        app.stomp_manager = types.SimpleNamespace(
            is_login_phase=True,
            connect=Mock(return_value=(False, "Websocket unavailable")),
        )
        app.p2p_manager = types.SimpleNamespace(is_login_phase=True)
        app._configure_encryption_key = Mock()
        app._configure_server_connection = Mock()
        return app

    def test_transient_saved_auth_validation_failure_does_not_open_login(self):
        app = self.build_application(
            SessionValidationResult(
                valid=None,
                reason="session validation request failed",
                error="ConnectTimeout",
            )
        )
        app._configure_server_connection.side_effect = ConnectionError(
            "tailnet unavailable"
        )

        with patch(
            "core.application.LoginForm",
            side_effect=AssertionError("login form must remain closed"),
        ):
            app.authenticate_and_connect()

        self.assertFalse(app.stomp_manager.is_login_phase)
        app.stomp_manager.connect.assert_called_once_with()

    def test_saved_api_key_connection_failure_does_not_open_login(self):
        app = self.build_application(
            SessionValidationResult(valid=True, reason="saved login active")
        )

        with patch(
            "core.application.LoginForm",
            side_effect=AssertionError("login form must remain closed"),
        ):
            app.authenticate_and_connect()

        self.assertFalse(app.stomp_manager.is_login_phase)
        app.stomp_manager.connect.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
