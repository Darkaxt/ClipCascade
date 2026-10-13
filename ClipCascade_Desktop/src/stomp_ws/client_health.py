import json
import logging
import re

DESTINATION = "/app/client-health"


def _publish(client, message):
    if client is None or not client.connected:
        return
    try:
        client.send(destination=DESTINATION, body=json.dumps({"protocol": 1, **message}))
    except Exception:
        logging.debug("Client health control send unavailable")


def attach_client_health(client, version):
    def receive(frame):
        try:
            message = json.loads(frame.body)
            probe_id = message.get("probeId")
            if (message.get("protocol") == 1 and message.get("kind") == "probe"
                    and isinstance(probe_id, str)
                    and re.fullmatch(r"[A-Za-z0-9-]{1,64}", probe_id)):
                _publish(client, {"kind": "ack", "ackType": "client_alive", "probeId": probe_id})
        except (ValueError, TypeError, AttributeError):
            pass

    client.subscribe(destination="/user/queue/client-health", callback=receive)
    _publish(client, {"kind": "hello", "platform": "windows", "version": version})


def report_clipboard_detected(client, clipboard_type):
    if clipboard_type in ("text", "image", "files"):
        _publish(client, {"kind": "ack", "ackType": "clipboard_detected", "clipboardType": clipboard_type})
