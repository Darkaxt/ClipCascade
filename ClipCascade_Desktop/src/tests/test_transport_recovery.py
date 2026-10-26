import ssl
import threading
import socket
import subprocess
from pathlib import Path
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from core.config import Config
from stomp_ws.client import Client
from stomp_ws.stomp_manager import STOMPManager
from utils.ssl_helper import create_request_session


class RecoveryTests(unittest.TestCase):
    def test_close_at_handshake_completion_cannot_report_connected(self):
        manager = STOMPManager(Config())
        client = Mock(connected=False)
        client.connect.side_effect = lambda **_: manager._on_close(client)
        with (
            patch('stomp_ws.stomp_manager.Client', return_value=client),
            patch.object(manager, '_validate_saved_session_before_connect', return_value=(True, '')),
            patch.object(manager.clipboard_manager, 'on_copy') as watch,
        ):
            success, _ = manager.connect()
        self.assertFalse(success)
        self.assertFalse(manager.is_connected)
        watch.assert_not_called()

    def test_manual_resend_bypasses_duplicate_but_ordinary_send_does_not(self):
        manager = STOMPManager(Config(), is_login_phase=False)
        manager.config.data['cipher_enabled'] = False
        manager.is_connected = True
        manager.client = Mock()
        delivery_id = manager.delivery.begin('same text', 'text')
        manager.delivery.acknowledge({'protocol': 1, 'kind': 'clipboard_delivery',
                                     'deliveryId': delivery_id, 'expected': 1,
                                     'applied': 1, 'complete': True})
        manager.send('same text')
        manager.client.send.assert_not_called()
        self.assertTrue(manager.resend_text('same text'))
        self.assertTrue(manager.resend_text('same text'))
        self.assertEqual(manager.client.send.call_count, 2)
        manager.is_connected = False
        self.assertFalse(manager.resend_text('same text'))
        self.assertEqual(manager.client.send.call_count, 2)

    def test_real_websocket_recovers_after_repeated_dns_failure(self):
        server = subprocess.Popen(
            ['node', str(Path(__file__).with_name('stomp_recovery_server.cjs'))],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True,
        )
        manager = STOMPManager(Config(), is_login_phase=False)
        manager.config.data['websocket_url'] = f'ws://127.0.0.1:{server.stdout.readline().strip()}'
        real_resolve = socket.getaddrinfo
        failures = [True, True]
        connected = threading.Event()
        connects = []

        def resolve(*args, **kwargs):
            if failures:
                failures.pop()
                raise socket.gaierror('diagnostic DNS outage')
            return real_resolve(*args, **kwargs)

        def watcher(*args):
            connects.append(True)
            connected.set()

        try:
            with (
                patch.object(manager, '_validate_saved_session_before_connect', return_value=(True, '')),
                patch.object(manager.clipboard_manager, 'on_copy', side_effect=watcher),
                patch.object(manager.notification_manager, 'notify'),
                patch('socket.getaddrinfo', side_effect=resolve),
                patch('stomp_ws.stomp_manager.RECONNECT_WS_TIMER', 0),
            ):
                success, _ = manager.connect()
                self.assertFalse(success)
                self.assertTrue(connected.wait(5), 'no recovery after DNS restored')
                manager.client.send('/app/cliptext', body='network-recovery-probe')
                self.assertEqual(server.stdout.readline().strip(), 'sent')
                connected.clear()
                failures.extend([True, True])
                server.stdin.write('drop\n')
                server.stdin.flush()
                self.assertTrue(connected.wait(5), 'no recovery after established socket loss')
                manager.client.send('/app/cliptext', body='second-recovery-probe')
                self.assertEqual(server.stdout.readline().strip(), 'sent')
                self.assertEqual(len(connects), 2)
        finally:
            manager.disconnect()
            if manager._reconnect_thread:
                manager._reconnect_thread.join()
            if server.poll() is None:
                server.stdin.write('stop\n')
                server.stdin.flush()
            server.communicate()

    def test_stale_close_cannot_disconnect_replacement(self):
        manager = STOMPManager(Config(), is_login_phase=False)
        old = object()
        manager.client = object()
        manager.is_connected = True
        manager._on_close(old)
        self.assertTrue(manager.is_connected)

    def test_failed_reconnect_keeps_retrying_without_another_close_event(self):
        manager = STOMPManager(Config(), is_login_phase=False)
        restored = threading.Event()
        attempts = []

        def connect():
            attempts.append(True)
            if len(attempts) == 3:
                manager.is_connected = True
                restored.set()
                return True, ''
            return False, 'DNS unavailable'

        manager.connect = connect
        manager.client = object()
        with patch('stomp_ws.stomp_manager.RECONNECT_WS_TIMER', 0):
            manager._on_close(manager.client)
            self.assertTrue(restored.wait(3), 'reconnect worker failed to recover')
            manager.disconnected = True
            manager._reconnect_stop.set()
            manager._reconnect_needed.set()
            manager._reconnect_thread.join()
        self.assertEqual(len(attempts), 3)

    def test_websocket_open_is_not_a_stomp_connection(self):
        client = Client('ws://example.test')
        client.ws.send = Mock()
        client._on_open(client.ws)
        self.assertFalse(client.connected)
        self.assertTrue(client.ws.send.call_args.args[0].startswith('CONNECT'))

    def test_default_https_does_not_need_extracted_certifi_file(self):
        with create_request_session() as session:
            adapter = session.get_adapter('https://example.test')
            request = SimpleNamespace(url='https://example.test')
            with patch('requests.adapters.DEFAULT_CA_BUNDLE_PATH', 'Z:/missing.pem'):
                _, options = adapter.build_connection_pool_key_attributes(request, True)
                adapter.cert_verify(SimpleNamespace(), request.url, True, None)
            self.assertEqual(options['ssl_context'].verify_mode, ssl.CERT_REQUIRED)
            self.assertTrue(options['ssl_context'].check_hostname)

    def test_custom_ca_still_checks_file(self):
        with create_request_session() as session:
            adapter = session.get_adapter('https://example.test')
            with self.assertRaises(OSError):
                adapter.cert_verify(SimpleNamespace(), 'https://example.test', 'Z:/missing.pem', None)


if __name__ == '__main__':
    unittest.main()
