import json
import unittest
from unittest.mock import Mock

from stomp_ws.client_health import attach_client_health, report_clipboard_detected


class ClientHealthTests(unittest.TestCase):
    def test_probe_ack_is_separate_and_typed_without_clipboard_data(self):
        client = Mock(connected=True)
        attach_client_health(client, "3.2.0.29")
        self.assertEqual(client.subscribe.call_args.kwargs["destination"], "/user/queue/client-health")
        hello = json.loads(client.send.call_args.kwargs["body"])
        self.assertEqual(hello["kind"], "hello")
        callback = client.subscribe.call_args.kwargs["callback"]
        client.send.reset_mock()
        callback(Mock(body=json.dumps({"protocol": 1, "kind": "probe", "probeId": "abc-123"})))
        self.assertEqual(json.loads(client.send.call_args.kwargs["body"]), {
            "protocol": 1, "kind": "ack", "ackType": "client_alive", "probeId": "abc-123",
        })
        client.send.reset_mock()
        for body in ['{', '{}', '{"protocol":2,"kind":"probe","probeId":"abc"}']:
            callback(Mock(body=body))
        client.send.assert_not_called()

    def test_capture_ack_is_metadata_only_offline_and_errors_are_nonfatal(self):
        client = Mock(connected=True)
        report_clipboard_detected(client, "image")
        self.assertEqual(json.loads(client.send.call_args.kwargs["body"]), {
            "protocol": 1, "kind": "ack", "ackType": "clipboard_detected", "clipboardType": "image",
        })
        client.send.reset_mock()
        client.connected = False
        report_clipboard_detected(client, "text")
        client.send.assert_not_called()
        client.connected = True
        client.send.side_effect = OSError("closed")
        report_clipboard_detected(client, "files")
