import unittest
from unittest.mock import patch

from core.config import Config
from utils.request_manager import RequestManager


class DummyResponse:
    def __init__(self, status_code=200, text="OK", headers=None):
        self.status_code = status_code
        self.text = text
        self.headers = headers or {}


class DummySession:
    def __init__(self, post_response):
        self.post_response = post_response
        self.cookies = self
        self.get_calls = []
        self.post_calls = []

    def get_dict(self):
        return {"SESSION": "session-token"}

    def get(self, *args, **kwargs):
        self.get_calls.append((args, kwargs))
        return DummyResponse(
            status_code=200,
            text='<input type="hidden" name="_csrf" value="csrf-token">',
        )

    def post(self, *args, **kwargs):
        self.post_calls.append((args, kwargs))
        return self.post_response


class RequestManagerSessionTests(unittest.TestCase):
    def test_format_cookie_preserves_spring_session_cookie_name(self):
        cookie_header = RequestManager.format_cookie({"SESSION": "abc"})

        self.assertEqual("SESSION=abc;", cookie_header)

    def test_format_cookie_keeps_legacy_jsessionid_cookie_name(self):
        cookie_header = RequestManager.format_cookie({"JSESSIONID": "abc"})

        self.assertEqual("JSESSIONID=abc;", cookie_header)

    def test_login_accepts_success_redirect_without_following_redirect_target(self):
        config = Config()
        config.data["server_url"] = "https://clipcascade.example.test"
        config.data["username"] = "admin"
        config.data["password"] = "hashed-password"
        session = DummySession(DummyResponse(status_code=302, headers={"Location": "/"}))

        with patch("utils.request_manager.requests.Session", return_value=session):
            success, msg, cookie = RequestManager(config).login()

        self.assertTrue(success)
        self.assertEqual("Login successful", msg)
        self.assertEqual({"SESSION": "session-token"}, cookie)
        self.assertFalse(session.post_calls[0][1]["allow_redirects"])

    def test_login_rejects_bad_credentials_redirect(self):
        config = Config()
        config.data["server_url"] = "https://clipcascade.example.test"
        config.data["username"] = "admin"
        config.data["password"] = "wrong-password"
        session = DummySession(
            DummyResponse(status_code=302, headers={"Location": "/login?error"})
        )

        with patch("utils.request_manager.requests.Session", return_value=session):
            success, msg, cookie = RequestManager(config).login()

        self.assertFalse(success)
        self.assertIn("Login failed", msg)
        self.assertIsNone(cookie)
        self.assertFalse(session.post_calls[0][1]["allow_redirects"])

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

    def test_auth_headers_prefers_api_key_over_cookie(self):
        config = Config()
        config.data["api_key"] = "cck_secret"
        config.data["cookie"] = {"JSESSIONID": "abc"}

        headers = RequestManager(config).auth_headers()

        self.assertEqual({"X-ClipCascade-Api-Key": "cck_secret"}, headers)

    def test_stomp_headers_include_api_key(self):
        config = Config()
        config.data["api_key"] = "cck_secret"

        headers = RequestManager(config).stomp_headers()

        self.assertEqual({"x-clipcascade-api-key": "cck_secret"}, headers)

    def test_validate_session_uses_api_key_without_cookie(self):
        config = Config()
        config.data["server_url"] = "https://clipcascade.example.test"
        config.data["api_key"] = "cck_secret"

        with patch(
            "utils.request_manager.requests.get",
            return_value=DummyResponse(status_code=200),
        ) as mock_get:
            result = RequestManager(config).validate_session_result()

        self.assertTrue(result.valid)
        self.assertEqual(
            {"X-ClipCascade-Api-Key": "cck_secret"},
            mock_get.call_args.kwargs["headers"],
        )


if __name__ == "__main__":
    unittest.main()
