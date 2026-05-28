import json
import logging
import requests
from dataclasses import dataclass
from typing import Optional
from core.constants import *
from core.config import Config
from bs4 import BeautifulSoup
from utils.ssl_helper import requests_verify_arg


@dataclass
class SessionValidationResult:
    valid: Optional[bool]
    reason: str
    http_status: Optional[int] = None
    location: str = ""
    error: str = ""

    def summary(self) -> str:
        parts = [self.reason]
        if self.http_status is not None:
            parts.append(f"HTTP {self.http_status}")
        if self.location:
            parts.append(f"Location: {self.location}")
        if self.error:
            parts.append(self.error)
        return "; ".join(parts)


class RequestManager:
    def __init__(self, config: Config):
        self.config = config

    def _verify(self):
        return requests_verify_arg(self.config)

    def has_api_key(self) -> bool:
        return bool((self.config.data.get("api_key") or "").strip())

    def auth_headers(self) -> dict:
        api_key = (self.config.data.get("api_key") or "").strip()
        if api_key:
            return {"X-ClipCascade-Api-Key": api_key}

        cookie = self.config.data.get("cookie")
        if cookie:
            return {"Cookie": RequestManager.format_cookie(cookie)}

        return {}

    def stomp_headers(self) -> dict:
        api_key = (self.config.data.get("api_key") or "").strip()
        if api_key:
            return {"x-clipcascade-api-key": api_key}

        return {}

    @staticmethod
    def format_cookie(cookie: dict) -> str:
        """
        Format the cookie string for headers.
        """
        if not cookie:
            return ""
        return "".join(f"{key}={value};" for key, value in cookie.items())

    def login(self) -> tuple[bool, str, dict]:
        try:
            if self.has_api_key():
                result = self.validate_session_result()
                if result.valid:
                    logging.info("API key authentication successful")
                    return True, "API key accepted", self.config.data.get("cookie")
                msg = "API key rejected: " + result.summary()
                logging.error(msg)
                return False, msg, None

            session = requests.Session()

            # Fetch the login page to get the CSRF token
            response = session.get(
                self.config.data["server_url"] + LOGIN_URL,
                verify=self._verify(),
            )

            if response.status_code != 200:
                msg = f"Failed to fetch login page: {response.status_code}"
                logging.error(msg)
                return False, msg, None

            soup = BeautifulSoup(response.text, "html.parser")
            csrf_token = soup.find("input", {"name": "_csrf"})["value"]

            # Login with the credentials
            form_data = {
                "username": self.config.data["username"],
                "password": self.config.data["password"],
                "_csrf": csrf_token,
            }
            response = session.post(
                self.config.data["server_url"] + LOGIN_URL,
                data=form_data,
                allow_redirects=False,
                verify=self._verify(),
            )
            location = response.headers.get("Location", "")
            redirected_to_login_error = (
                response.status_code in (301, 302, 303, 307, 308)
                and "/login" in location
                and "error" in location
            )
            if (
                (
                    response.status_code == 200
                    or (
                        response.status_code in (301, 302, 303, 307, 308)
                        and not redirected_to_login_error
                    )
                )
                and "bad credentials" not in response.text.lower()
            ):
                # login successful
                cookie = session.cookies.get_dict()
                logging.info(f"Login successful: {response.status_code}")
                return True, "Login successful", cookie
            else:
                # login failed
                msg = f"Login failed: {response.status_code}"
                logging.error(msg)
                return False, msg, None
        except Exception as e:
            msg = f"An error occurred during login: {e}"
            logging.error(msg)
            return False, msg, None

    def maxsize(self) -> int:
        try:
            response = RequestManager.get(
                url=self.config.data["server_url"] + MAXSIZE_URL,
                headers=self.auth_headers(),
                verify=self._verify(),
            )
            if response.status_code == 200:
                # maxsize request successful
                maxsize = response.json().get("maxsize", MAX_SIZE)
                logging.info(f"Max size: {maxsize}")
                return maxsize
        except Exception as e:
            logging.error(
                f"Error fetching max size: {e}, defaulting to {MAX_SIZE} Bytes"
            )
        return MAX_SIZE

    def get_server_mode(self) -> str:
        try:
            response = RequestManager.get(
                url=self.config.data["server_url"] + SERVER_MODE_URL,
                headers=self.auth_headers(),
                verify=self._verify(),
            )
            if response.status_code == 200:
                # server mode request successful
                server_mode = response.json().get("mode")
                logging.info(f"Server mode: {server_mode}")
                return server_mode
        except Exception as e:
            logging.error(f"Error fetching server mode: {e}")
            raise

    def get_stun_url(self) -> str:
        try:
            response = RequestManager.get(
                url=self.config.data["server_url"] + STUN_URL,
                headers=self.auth_headers(),
                verify=self._verify(),
            )
            if response.status_code == 200:
                # stun url request successful
                stun_url = response.json().get("url")
                logging.info(f"STUN URL: {stun_url}")
                return stun_url
        except Exception as e:
            logging.error(f"Error fetching STUN URL: {e}")
            raise

    def get_metadata(self) -> dict:
        try:
            response = RequestManager.get(
                url=METADATA_URL,
                headers={
                    "Cookie": RequestManager.format_cookie(self.config.data["cookie"])
                },
                verify=True,
            )
            if response.status_code == 200:
                # metadata request successful
                return response.json()
        except Exception as e:
            logging.error(f"Error fetching metadata: {e}")
            raise

    def logout(self):
        try:
            response = RequestManager.post(
                url=self.config.data["server_url"] + LOGOUT_URL,
                data={"_csrf": self.config.data["csrf_token"]},
                headers=self.auth_headers(),
                verify=self._verify(),
            )
            if response.status_code == 204:
                logging.info(f"Logout successful: {response.status_code}")
        except Exception as e:
            logging.error(f"Error during logout: {e}")

    def get_csrf_token(self) -> str:
        try:
            response = RequestManager.get(
                url=self.config.data["server_url"] + CSRF_URL,
                headers=self.auth_headers(),
                verify=self._verify(),
            )

            if response.status_code == 200:
                # CSRF token request successful
                return json.loads(response.text).get("token", "")
        except Exception as e:
            logging.error(f"Error fetching CSRF token: {e}")
            return ""

    def validate_session_result(self) -> SessionValidationResult:
        try:
            headers = self.auth_headers()
            if not headers:
                return SessionValidationResult(
                    valid=False,
                    reason="missing saved login credential",
                )

            response = requests.get(
                self.config.data["server_url"] + VALIDATE_SESSION_URL,
                headers=headers,
                verify=self._verify(),
                allow_redirects=False,
                timeout=5,
            )
            if response.status_code == 200:
                return SessionValidationResult(valid=True, reason="saved login active")
            if response.status_code in {301, 302, 303, 307, 308, 401, 403}:
                if response.status_code in {401, 403}:
                    reason = "server rejected saved login"
                else:
                    reason = "server redirected saved login"
                return SessionValidationResult(
                    valid=False,
                    reason=reason,
                    http_status=response.status_code,
                    location=response.headers.get("Location", ""),
                )
            logging.warning(
                f"Unable to validate session: HTTP {response.status_code}"
            )
            return SessionValidationResult(
                valid=None,
                reason="unexpected session validation response",
                http_status=response.status_code,
            )
        except Exception as e:
            logging.warning(f"Unable to validate session: {e}")
            return SessionValidationResult(
                valid=None,
                reason="session validation request failed",
                error=f"{type(e).__name__}: {e}",
            )

    def validate_session(self):
        return self.validate_session_result().valid

    @staticmethod
    def get(url: str, headers: dict = None, verify=True) -> requests.Response:
        """
        A generic GET mapper for handling GET requests.
        """
        try:
            response = requests.get(url, headers=headers, verify=verify)
            response.raise_for_status()  # Will raise an HTTPError if the HTTP request returned an unsuccessful status code
            return response
        except Exception as e:
            logging.error(f"Error during GET request to {url}: {e}")
            raise

    @staticmethod
    def post(
        url: str, data: dict, headers: dict = None, verify=True
    ) -> requests.Response:
        """
        A generic POST mapper for handling POST requests.
        """
        try:
            response = requests.post(url, data=data, headers=headers, verify=verify)
            response.raise_for_status()  # Will raise an HTTPError if the HTTP request returned an unsuccessful status code
            return response
        except Exception as e:
            logging.error(f"Error during POST request to {url}: {e}")
            raise
