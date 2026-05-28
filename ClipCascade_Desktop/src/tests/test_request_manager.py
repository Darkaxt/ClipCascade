import unittest
from unittest.mock import patch

from core.config import Config
from utils.request_manager import RequestManager


class DummyResponse:
    def __init__(self, status_code=200, text="OK", headers=None):
        self.status_code = status_code
        self.text = text
        self.headers = headers or {}


class RequestManagerSessionTests(unittest.TestCase):
    def test_validate_session_returns_false_without_following_login_redirect(self):
        config = Config()
        config.data["server_url"] = "https://clipcascade.example.test"
        config.data["cookie"] = {"JSESSIONID": "abc"}

        with patch(
            "utils.request_manager.requests.get",
            return_value=DummyResponse(status_code=302),
        ) as mock_get:
            result = RequestManager(config).validate_session()

        self.assertFalse(result)
        self.assertFalse(mock_get.call_args.kwargs["allow_redirects"])

    def test_validate_session_result_preserves_rejection_details(self):
        config = Config()
        config.data["server_url"] = "https://clipcascade.example.test"
        config.data["cookie"] = {"JSESSIONID": "abc"}

        with patch(
            "utils.request_manager.requests.get",
            return_value=DummyResponse(
                status_code=302,
                headers={"Location": "https://clipcascade.example.test/login"},
            ),
        ):
            result = RequestManager(config).validate_session_result()

        self.assertFalse(result.valid)
        self.assertEqual(302, result.http_status)
        self.assertEqual("https://clipcascade.example.test/login", result.location)
        self.assertIn("HTTP 302", result.summary())


if __name__ == "__main__":
    unittest.main()
