import json
import types
import unittest
from unittest.mock import Mock

from core.config import Config
from stomp_ws.stomp_manager import STOMPManager


class ClipboardAppliedAckTests(unittest.TestCase):
    def manager(self):
        config = Config()
        config.data['cipher_enabled'] = False
        manager = STOMPManager(config, is_login_phase=False)
        manager.is_connected = True
        manager.client = Mock(connected=True)
        return manager

    def frame(self, message_id='00000000-0000-4000-8000-000000000001'):
        return types.SimpleNamespace(body=json.dumps({
            'type': 'text', 'payload': 'harmless test text',
            'metadata': {'deliveryId': message_id, 'sourceSessionId': 'phone-session'},
        }))

    def test_fresh_send_is_not_suppressed_before_application_ack(self):
        manager = self.manager()
        self.assertTrue(manager.send('harmless test text'))
        self.assertTrue(manager.send('harmless test text'))
        self.assertEqual(manager.client.send.call_count, 2)

    def test_ack_follows_successful_apply_and_retransmit_is_not_reapplied(self):
        manager = self.manager()
        manager.clipboard_manager.base64_to_clipboard = Mock(return_value=True)
        frame = self.frame()
        manager._receive(frame)
        manager._receive(frame)
        manager.clipboard_manager.base64_to_clipboard.assert_called_once()
        self.assertEqual(manager.client.send.call_count, 2)
        for call in manager.client.send.call_args_list:
            self.assertEqual(call.kwargs['destination'], '/app/clipboard-ack')
            self.assertEqual(json.loads(call.kwargs['body'])['ackType'], 'clipboard_applied')

    def test_failed_apply_does_not_ack_or_poison_retransmit(self):
        manager = self.manager()
        manager.clipboard_manager.base64_to_clipboard = Mock(side_effect=[False, True])
        manager._receive(self.frame())
        manager.client.send.assert_not_called()
        manager._receive(self.frame())
        self.assertEqual(manager.clipboard_manager.base64_to_clipboard.call_count, 2)
        manager.client.send.assert_called_once()

    def test_delivered_duplicate_suppression_is_invalidated_by_recipient_change(self):
        manager = self.manager()
        manager.send('harmless test text')
        sent = json.loads(manager.client.send.call_args.kwargs['body'])
        state = {'protocol': 1, 'kind': 'clipboard_delivery',
                 'deliveryId': sent['metadata']['deliveryId'], 'expected': 2, 'applied': 1, 'complete': False}
        manager._delivery_status(types.SimpleNamespace(body=json.dumps(state)))
        self.assertFalse(manager.delivery.should_suppress('harmless test text', 'text'))
        state.update(applied=2, complete=True)
        manager._delivery_status(types.SimpleNamespace(body=json.dumps(state)))
        self.assertTrue(manager.delivery.should_suppress('harmless test text', 'text'))
        manager._delivery_status(types.SimpleNamespace(body=json.dumps({
            'protocol': 1, 'kind': 'clipboard_delivery_reset'})))
        self.assertFalse(manager.delivery.should_suppress('harmless test text', 'text'))


if __name__ == '__main__':
    unittest.main()
