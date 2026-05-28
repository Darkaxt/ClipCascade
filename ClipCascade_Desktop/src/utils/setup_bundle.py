import json
import re


SETUP_BUNDLE_TYPE = "clipcascade-setup-v1"
SYNC_KEY_PATTERN = re.compile(r"^ccsk_[A-Za-z0-9_-]{43}$")


def parse_setup_bundle(raw_bundle: str) -> dict:
    if not raw_bundle or not raw_bundle.strip():
        raise ValueError("Setup bundle is empty")

    try:
        bundle = json.loads(raw_bundle)
    except json.JSONDecodeError as exc:
        raise ValueError("Setup bundle is not valid JSON") from exc

    if not isinstance(bundle, dict):
        raise ValueError("Setup bundle must be a JSON object")
    if bundle.get("type") != SETUP_BUNDLE_TYPE:
        raise ValueError("Unsupported setup bundle type")

    for key in ("serverUrl", "username", "apiKey", "clientId", "clientName"):
        if not str(bundle.get(key) or "").strip():
            raise ValueError(f"Setup bundle is missing {key}")

    if bundle.get("encryptionMode") == "sync_key":
        sync_key = str(bundle.get("syncEncryptionKey") or "").strip()
        if not SYNC_KEY_PATTERN.match(sync_key):
            raise ValueError("Setup bundle has an invalid sync encryption key")

    return bundle


def apply_setup_bundle_to_config(config, raw_bundle: str) -> dict:
    bundle = parse_setup_bundle(raw_bundle)

    config.data["server_url"] = str(bundle["serverUrl"]).strip().rstrip("/")
    config.data["username"] = str(bundle["username"]).strip()
    config.data["api_key"] = str(bundle["apiKey"]).strip()
    config.data["api_client_id"] = str(bundle["clientId"]).strip()
    config.data["api_client_name"] = str(bundle["clientName"]).strip()
    config.data["cipher_enabled"] = bool(bundle.get("cipherEnabled", True))
    config.data["password"] = ""
    config.data["hashed_password"] = None
    config.data["cookie"] = None
    config.data["csrf_token"] = ""

    if bundle.get("encryptionMode") == "sync_key":
        config.data["sync_encryption_key"] = str(bundle["syncEncryptionKey"]).strip()

    return bundle
