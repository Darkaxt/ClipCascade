import os
import ssl
import requests
from requests.adapters import HTTPAdapter
from typing import Any, Dict, Optional, Union

from core.constants import MACOS, PLATFORM, WINDOWS

if PLATFORM == MACOS:
    import certifi


class WindowsTrustAdapter(HTTPAdapter):
    """Use the OS trust store, not an expendable PyInstaller certifi path."""

    def __init__(self):
        self.context = ssl.create_default_context()
        super().__init__()

    def build_connection_pool_key_attributes(self, request, verify, cert=None):
        host, options = super().build_connection_pool_key_attributes(request, verify, cert)
        if verify is True:
            options['ssl_context'] = self.context
            options.pop('ca_certs', None)
            options.pop('ca_cert_dir', None)
        return host, options

    def cert_verify(self, conn, url, verify, cert):
        if url.lower().startswith('https') and verify is True and cert is None:
            conn.cert_reqs = 'CERT_REQUIRED'
            conn.ca_certs = None
            conn.ca_cert_dir = None
            return
        super().cert_verify(conn, url, verify, cert)


def create_request_session():
    session = requests.Session()
    if PLATFORM == WINDOWS:
        session.mount('https://', WindowsTrustAdapter())
    return session


def request_get(*args, **kwargs):
    with create_request_session() as session:
        return session.get(*args, **kwargs)


def request_post(*args, **kwargs):
    with create_request_session() as session:
        return session.post(*args, **kwargs)


def requests_verify_arg(config) -> Union[bool, str]:
    """Argument for requests' verify= when calling the user's server."""
    path = (config.data.get("ssl_ca_bundle") or "").strip()
    if not path:
        return True
    if not os.path.isfile(path):
        raise FileNotFoundError(f"SSL CA bundle file not found: {path}")
    return path


def websocket_sslopt_for_config(config) -> Optional[Dict[str, Any]]:
    """sslopt for websocket_client run_forever; None uses the library/OS default."""
    path = (config.data.get("ssl_ca_bundle") or "").strip()
    if path:
        if not os.path.isfile(path):
            raise FileNotFoundError(f"SSL CA bundle file not found: {path}")
        ctx = ssl.create_default_context(cafile=path)
        return {"context": ctx}
    if PLATFORM == MACOS:
        ctx = ssl.create_default_context(cafile=certifi.where())
        return {"context": ctx}
    return None
