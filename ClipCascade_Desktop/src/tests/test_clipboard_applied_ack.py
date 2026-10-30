import json
import types
import unittest
import threading
from unittest.mock import Mock, patch

from core.config import Config
from stomp_ws.stomp_manager import STOMPManager
from clipboard.windows_access import ClipboardBusyError


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

    def test_forty_unconfirmed_retries_do_not_reapply_on_successful_recipient(self):
        sender = self.manager()
        successful = self.manager()
        unavailable = self.manager()
        successful.clipboard_manager.base64_to_clipboard = Mock(return_value=True)
        unavailable.clipboard_manager.base64_to_clipboard = Mock(return_value=False)
        for _ in range(40):
            self.assertTrue(sender.send('retry example'))
            message = json.loads(sender.client.send.call_args.kwargs['body'])
            message['metadata']['sourceSessionId'] = 'source-session'
            frame = types.SimpleNamespace(body=json.dumps(message))
            successful._receive(frame)
            unavailable._receive(frame)
        successful.clipboard_manager.base64_to_clipboard.assert_called_once()
        self.assertEqual(unavailable.clipboard_manager.base64_to_clipboard.call_count, 40)
        unavailable.client.send.assert_not_called()

    def test_encrypted_retry_reuses_identical_wire_body_until_explicit_resend(self):
        manager = self.manager()
        manager.config.data['cipher_enabled'] = True
        manager.cipher_manager.encrypt = Mock(side_effect=[{'nonce': b'first'}, {'nonce': b'next'}])
        self.assertTrue(manager.send('retry example'))
        first = manager.client.send.call_args.kwargs['body']
        self.assertTrue(manager.send('retry example'))
        self.assertEqual(manager.client.send.call_args.kwargs['body'], first)
        self.assertTrue(manager.resend_text('retry example'))
        self.assertNotEqual(manager.client.send.call_args.kwargs['body'], first)
        self.assertEqual(manager.cipher_manager.encrypt.call_count, 2)

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

    def test_busy_apply_recovers_outside_transport_and_only_then_acknowledges(self):
        manager = self.manager()
        waiting, release, acknowledged = threading.Event(), threading.Event(), threading.Event()
        def apply(*args, **kwargs):
            if not kwargs.get('access_options'):
                raise ClipboardBusyError('held by another application')
            waiting.set()
            release.wait()
            return True
        manager.clipboard_manager.base64_to_clipboard = Mock(side_effect=apply)
        manager.client.send.side_effect = lambda **_: acknowledged.set()
        try:
            manager._receive(self.frame())
            self.assertTrue(waiting.wait(2))
            manager.client.send.assert_not_called()
            manager._receive(self.frame())
            self.assertEqual(manager.clipboard_manager.base64_to_clipboard.call_count, 2)
            release.set()
            self.assertTrue(acknowledged.wait(2))
            manager.client.send.assert_called_once()
            manager._receive(self.frame())
            self.assertEqual(manager.clipboard_manager.base64_to_clipboard.call_count, 2)
        finally:
            release.set()
            manager._pending_clipboard.cancel()

    def test_disconnect_cancels_pending_application_without_ack(self):
        manager = self.manager()
        waiting, release, finished = threading.Event(), threading.Event(), threading.Event()
        from clipboard.windows_access import ClipboardApplyCancelled
        def apply(*args, **kwargs):
            options = kwargs.get('access_options')
            if not options:
                raise ClipboardBusyError('clipboard not accessible')
            waiting.set()
            release.wait()
            try:
                self.assertTrue(options['cancelled']())
                raise ClipboardApplyCancelled('superseded')
            finally:
                finished.set()
        manager.clipboard_manager.base64_to_clipboard = Mock(side_effect=apply)
        try:
            manager._receive(self.frame())
            self.assertTrue(waiting.wait(2))
            manager.is_connected = False
            manager._pending_clipboard.cancel()
            release.set()
            self.assertTrue(finished.wait(2))
            manager.client.send.assert_not_called()
        finally:
            release.set()

    def test_new_local_clipboard_sequence_cancels_stale_pending_write(self):
        manager = self.manager()
        waiting, release, finished = threading.Event(), threading.Event(), threading.Event()
        from clipboard.windows_access import ClipboardApplyCancelled
        def apply(*args, **kwargs):
            options = kwargs.get('access_options')
            if not options:
                raise ClipboardBusyError('busy')
            waiting.set()
            release.wait()
            try:
                self.assertTrue(options['cancelled']())
                raise ClipboardApplyCancelled('newer local copy')
            finally:
                finished.set()
        manager.clipboard_manager.base64_to_clipboard = Mock(side_effect=apply)
        with patch('stomp_ws.stomp_manager.win32clipboard.GetClipboardSequenceNumber', return_value=100) as sequence:
            try:
                manager._receive(self.frame())
                self.assertTrue(waiting.wait(2))
                sequence.return_value = 101
                release.set()
                self.assertTrue(finished.wait(2))
                manager.client.send.assert_not_called()
            finally:
                release.set()
                manager._pending_clipboard.cancel()

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
