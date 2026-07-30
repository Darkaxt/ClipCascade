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


if __name__ == "__main__":
    unittest.main()
