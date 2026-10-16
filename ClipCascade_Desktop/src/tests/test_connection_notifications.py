import unittest
from unittest.mock import Mock, patch
from types import SimpleNamespace

from utils.connection_notifications import ConnectionNotifications


class FakeTimer:
    instances = []

    def __init__(self, seconds, callback):
        self.seconds = seconds
        self.callback = callback
        self.cancelled = False
        self.instances.append(self)

    def start(self):
        pass

    def cancel(self):
        self.cancelled = True

    def fire(self):
        # Exercise stale callbacks even after cancellation.
        self.callback()


class ConnectionNotificationTests(unittest.TestCase):
    def setUp(self):
        FakeTimer.instances = []
        self.notify = Mock()
        self.policy = ConnectionNotifications(self.notify, 60, FakeTimer)

    def test_short_outage_and_initial_connection_are_silent(self):
        self.policy.connected()
        self.policy.lost()
        timer = FakeTimer.instances[-1]
        self.assertEqual(timer.seconds, 60)
        self.notify.assert_not_called()
        self.policy.connected()
        timer.fire()
        self.notify.assert_not_called()

    def test_repeated_loss_does_not_extend_grace_or_repeat_warning(self):
        self.policy.lost()
        self.policy.lost()
        self.assertEqual(len(FakeTimer.instances), 1)
        FakeTimer.instances[-1].fire()
        self.assertIn('Lost', self.notify.call_args.kwargs['title'])
        self.policy.lost()
        self.assertEqual(self.notify.call_count, 1)

    def test_recovery_waits_for_stability_and_flapping_cancels_it(self):
        self.policy.lost()
        FakeTimer.instances[-1].fire()
        self.policy.connected()
        recovery = FakeTimer.instances[-1]
        self.assertEqual(recovery.seconds, 60)
        self.assertEqual(self.notify.call_count, 1)
        self.policy.lost()
        recovery.fire()
        self.assertEqual(self.notify.call_count, 1)
        self.policy.connected()
        FakeTimer.instances[-1].fire()
        self.assertEqual(self.notify.call_count, 2)
        self.assertIn('Restored', self.notify.call_args.kwargs['title'])
        self.policy.lost()
        self.assertEqual(len(FakeTimer.instances), 4)

    def test_reset_cancels_loss_and_recovery_callbacks(self):
        for warned in (False, True):
            self.policy.lost()
            if warned:
                FakeTimer.instances[-1].fire()
                self.policy.connected()
            timer = FakeTimer.instances[-1]
            self.policy.reset()
            self.notify.reset_mock()
            timer.fire()
            self.notify.assert_not_called()

    def test_other_platform_immediate_policy(self):
        policy = ConnectionNotifications(self.notify, 0, FakeTimer)
        policy.lost()
        policy.connected()
        self.assertEqual(self.notify.call_count, 2)
        self.assertEqual(FakeTimer.instances, [])

    def test_p2s_reconnect_starts_before_notification_and_recovery_is_silent(self):
        from core.config import Config
        from stomp_ws.stomp_manager import STOMPManager

        manager = STOMPManager(Config(), is_login_phase=False)
        manager.connection_notifications = self.policy
        client = Mock(connected=True)
        manager.client = client
        with patch.object(manager, '_start_reconnect') as reconnect:
            manager._on_close(client)
            reconnect.assert_called_once()
        self.notify.assert_not_called()
        timer = FakeTimer.instances[-1]
        with (
            patch('stomp_ws.stomp_manager.Client', return_value=client),
            patch.object(manager, '_validate_saved_session_before_connect', return_value=(True, '')),
            patch.object(manager.clipboard_manager, 'on_copy'),
        ):
            self.assertTrue(manager.connect()[0])
        timer.fire()
        self.notify.assert_not_called()
        manager.disconnect()

    def test_p2p_close_and_open_use_same_grace_policy(self):
        from p2p.p2p_manager import P2PManager

        holder = SimpleNamespace(
            ws_client=Mock(), is_connected=True, disconnected=False,
            is_login_phase=False, _suppress_auto_reconnect_once=False,
            connection_notifications=self.policy, connect=Mock(),
            loop=Mock(), _prepare_reconnect_bootstrap=Mock(),
            _restart_dc_heartbeat=Mock(),
        )
        with patch('p2p.p2p_manager.time.sleep'):
            P2PManager._on_ws_close(holder, holder.ws_client)
        holder.connect.assert_called_once()
        timer = FakeTimer.instances[-1]
        self.notify.assert_not_called()
        with patch('p2p.p2p_manager.asyncio.run_coroutine_threadsafe'):
            P2PManager._on_ws_open(holder, Mock())
        timer.fire()
        self.notify.assert_not_called()
