import sys
import unittest
from pathlib import Path
from unittest.mock import Mock


SRC_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SRC_DIR))

from utils.activity_log import ActivityLog  # noqa: E402
from utils.activity_replay import ActivityReplayController  # noqa: E402


class ActivityReplayControllerTest(unittest.TestCase):
    def test_replays_selected_text_through_injected_local_copy(self):
        log = ActivityLog()
        row = log.append("Remote", "Text", "Applied", "preview", replay_text="full value")
        copy_text_locally = Mock(return_value=True)
        controller = ActivityReplayController(log, copy_text_locally)

        self.assertTrue(controller.can_replay(row.event_id))
        self.assertEqual(controller.replay(row.event_id), "copied")
        copy_text_locally.assert_called_once_with("full value")

    def test_rejects_non_text_and_evicted_rows(self):
        log = ActivityLog(replay_cache_limit_bytes=4)
        image = log.append("Remote", "Image", "Applied", "Image")
        text = log.append("Remote", "Text", "Applied", "preview", replay_text="12345")
        copy_text_locally = Mock(return_value=True)
        controller = ActivityReplayController(log, copy_text_locally)

        self.assertFalse(controller.can_replay(image.event_id))
        self.assertFalse(controller.can_replay(text.event_id))
        self.assertEqual(controller.replay(image.event_id), "unavailable")
        self.assertEqual(controller.replay(text.event_id), "unavailable")
        copy_text_locally.assert_not_called()

    def test_reports_clipboard_write_failure(self):
        log = ActivityLog()
        row = log.append("Local", "Text", "Detected", "value", replay_text="value")
        controller = ActivityReplayController(log, Mock(return_value=False))

        self.assertEqual(controller.replay(row.event_id), "write_failed")

    def test_resend_is_explicit_and_preserves_local_clipboard(self):
        log = ActivityLog()
        row = log.append("Local", "Text", "Sent", "preview", replay_text="full value")
        copy = Mock()
        send = Mock(return_value=True)
        connected = Mock(return_value=True)
        controller = ActivityReplayController(log, copy, send, connected)
        self.assertTrue(controller.can_resend(row.event_id))
        self.assertEqual(controller.resend(row.event_id), "requested")
        self.assertEqual(controller.resend(row.event_id), "requested")
        self.assertEqual(send.call_count, 2)
        send.assert_called_with("full value")
        copy.assert_not_called()
        connected.return_value = False
        self.assertFalse(controller.can_resend(row.event_id))
        self.assertEqual(controller.resend(row.event_id), "disconnected")
        self.assertEqual(send.call_count, 2)
        log.clear()
        self.assertEqual(controller.resend(row.event_id), "unavailable")


if __name__ == "__main__":
    unittest.main()
