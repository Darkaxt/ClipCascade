import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from utils.activity_log import ActivityLog
from utils.activity_presentation import filter_activity_events, status_tone


class ActivityPresentationTests(unittest.TestCase):
    def test_filters_search_type_and_attention_without_rewriting_status(self):
        log = ActivityLog()
        applied = log.append('Remote', 'Text', 'Applied', 'Project notes')
        pending = log.append('Local', 'Text', 'Sent', 'Project folder')
        error = log.append('Remote', 'Image', 'Error', 'Image', detail='Clipboard busy')
        rows = log.snapshot()
        self.assertEqual(filter_activity_events(rows, 'PROJECT'), [pending, applied])
        self.assertEqual(filter_activity_events(rows, '', 'Text'), [pending, applied])
        self.assertEqual(filter_activity_events(rows, '', 'Needs attention'), [error, pending])
        self.assertEqual(filter_activity_events(rows, 'busy'), [error])
        self.assertEqual([row.status for row in rows], ['Error', 'Sent', 'Applied'])

    def test_only_application_success_has_success_tone(self):
        self.assertEqual(status_tone('Delivered'), 'good')
        self.assertEqual(status_tone('Applied'), 'good')
        self.assertEqual(status_tone('Sent'), 'pending')
        self.assertEqual(status_tone('Error'), 'error')
        self.assertEqual(status_tone('Available'), 'muted')
        self.assertEqual(status_tone('Suppressed'), 'muted')


if __name__ == '__main__':
    unittest.main()
