import base64
import hashlib
import os

import requests
from Crypto.Cipher import AES

from utils.cipher_manager import CipherManager
from utils.ssl_helper import requests_verify_arg


ENROLLMENT_URL = "/api/client-enrollment"
WRAP_VERSION = "pbkdf2-sha256-aes-gcm-v1"
WRAP_ROUNDS = 210000
WRAP_SALT_BYTES = 16
WRAP_NONCE_BYTES = 12


def encode_sync_encryption_key(raw_key: bytes) -> str:
    if len(raw_key) != 32:
        raise ValueError("Sync encryption key must be 32 bytes")
    encoded = base64.urlsafe_b64encode(raw_key).decode("ascii").rstrip("=")
    return f"ccsk_{encoded}"


def generate_sync_encryption_key() -> str:
    return encode_sync_encryption_key(os.urandom(32))


def _base64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _base64url_decode(encoded: str) -> bytes:
    padding = "=" * (-len(encoded) % 4)
    return base64.urlsafe_b64decode((encoded + padding).encode("ascii"))


def _derive_wrapping_key(raw_password: str, salt: bytes, rounds: int) -> bytes:
    if not raw_password:
        raise ValueError("Account password is required to wrap the sync encryption key")
    return hashlib.pbkdf2_hmac(
        "sha256",
        raw_password.encode("utf-8"),
        salt,
        rounds,
        dklen=32,
    )


def wrap_sync_encryption_key(raw_password: str, sync_encryption_key: str) -> dict:
    salt = os.urandom(WRAP_SALT_BYTES)
    nonce = os.urandom(WRAP_NONCE_BYTES)
    wrapping_key = _derive_wrapping_key(raw_password, salt, WRAP_ROUNDS)
    cipher = AES.new(wrapping_key, AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(sync_encryption_key.encode("utf-8"))
    return {
        "version": WRAP_VERSION,
        "rounds": str(WRAP_ROUNDS),
        "salt": _base64url_encode(salt),
        "nonce": nonce.hex(),
        "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
        "tag": tag.hex(),
    }


def unwrap_sync_encryption_key(raw_password: str, key_wrap: dict) -> str:
    if key_wrap.get("version") != WRAP_VERSION:
        raise ValueError("Unsupported wrapped sync key version")

    rounds = int(key_wrap["rounds"])
    salt = _base64url_decode(key_wrap["salt"])
    nonce = bytes.fromhex(key_wrap["nonce"])
    ciphertext = base64.b64decode(key_wrap["ciphertext"])
    tag = bytes.fromhex(key_wrap["tag"])
    wrapping_key = _derive_wrapping_key(raw_password, salt, rounds)
    cipher = AES.new(wrapping_key, AES.MODE_GCM, nonce=nonce)
    sync_encryption_key = cipher.decrypt_and_verify(ciphertext, tag).decode("utf-8")

    CipherManager.sync_encryption_key_to_bytes(sync_encryption_key)
    return sync_encryption_key


def enroll_client(config, raw_password: str, client_name: str = None) -> dict:
    local_sync_key = generate_sync_encryption_key()
    payload = {
        "username": config.data["username"],
        "passwordHash": CipherManager.string_to_sha3_512_lowercase_hex(raw_password),
        "clientName": client_name
        or config.data.get("api_client_name")
        or "Windows desktop",
        "keyWrap": wrap_sync_encryption_key(raw_password, local_sync_key),
    }

    server_url = config.data["server_url"].rstrip("/")
    response = requests.post(
        server_url + ENROLLMENT_URL,
        json=payload,
        verify=requests_verify_arg(config),
        allow_redirects=False,
        timeout=15,
    )
    response.raise_for_status()
    response_payload = response.json()
    sync_encryption_key = unwrap_sync_encryption_key(
        raw_password,
        response_payload["keyWrap"],
    )

    config.data["username"] = response_payload.get("username") or config.data["username"]
    config.data["api_key"] = response_payload["apiKey"]
    config.data["api_client_id"] = response_payload.get("clientId", "")
    config.data["api_client_name"] = response_payload.get(
        "clientName",
        payload["clientName"],
    )
    config.data["sync_encryption_key"] = sync_encryption_key
    config.data["cipher_enabled"] = True
    config.data["cookie"] = None
    config.data["csrf_token"] = ""
    config.data["password"] = ""
    config.data["hashed_password"] = None
    return response_payload
