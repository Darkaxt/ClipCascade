API_AUTH_KEYS = ("api_key", "api_client_id", "api_client_name")
SESSION_AUTH_KEYS = ("cookie", "csrf_token", "hashed_password")


def clear_rejected_api_auth(data: dict) -> bool:
    """Drop rejected API/session credentials without wiping reusable config."""
    if not str(data.get("api_key") or "").strip():
        return False

    for key in API_AUTH_KEYS:
        data[key] = ""

    data["cookie"] = None
    data["csrf_token"] = ""
    data["hashed_password"] = None
    return True
