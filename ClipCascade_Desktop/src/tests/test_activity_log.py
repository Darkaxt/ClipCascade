import sys
import unittest
from pathlib import Path

from PIL import Image


SRC_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SRC_DIR))

from utils.activity_log import ActivityLog  # noqa: E402


class ActivityLogTest(unittest.TestCase):
    def test_caps_rows_and_returns_newest_first(self):
        log = ActivityLog(max_rows=3)

        for i in range(5):
            log.append("Local", "Text", "Detected", f"payload {i}", "P2S")

        rows = log.snapshot()
        self.assertEqual([row.preview for row in rows], ["payload 4", "payload 3", "payload 2"])

    def test_text_preview_collapses_whitespace_and_truncates(self):
        payload = "alpha\n\t beta   " + ("x" * 80)

        preview = ActivityLog.preview_text(payload)

        self.assertNotIn("\n", preview)
        self.assertNotIn("\t", preview)
        self.assertLessEqual(len(preview), 49)
        self.assertTrue(preview.endswith("..."))

    def test_image_preview_stores_metadata_only(self):
        img = Image.new("RGB", (12, 9), (10, 20, 30))

        preview = ActivityLog.preview_image(img, approx_size_bytes=2048)

        self.assertEqual(preview, "Image 12x9, 2.0 KiB")

    def test_file_preview_uses_count_and_names(self):
        preview = ActivityLog.preview_files(
            [
                r"C:\Users\darka\Downloads\first.txt",
                r"C:\Users\darka\Downloads\second.png",
                r"C:\Users\darka\Downloads\third.zip",
            ]
        )

        self.assertEqual(preview, "3 files: first.txt, second.png, +1 more")

    def test_activity_logging_does_not_write_preview_content(self):
        log = ActivityLog(max_rows=3)

        with self.assertLogs(level="INFO") as captured:
            log.append("Local", "Text", "Sent", "super secret copied text", "P2S")

        output = "\n".join(captured.output)
        self.assertIn("Activity: Local Text Sent via P2S", output)
        self.assertNotIn("super secret", output)

    def test_duplicate_payload_ignored_is_shown_as_suppressed(self):
        log = ActivityLog(max_rows=3)

        row = log.append(
            "Remote",
            "Text",
            "Ignored",
            "payload",
            "P2S",
            "Duplicate payload",
        )

        self.assertEqual(row.status, "Suppressed")
        self.assertEqual(row.detail, "Duplicate payload; no resend")
        self.assertEqual(log.snapshot()[0].status, "Suppressed")

    def test_local_duplicate_suppression_replaces_detected_row(self):
        log = ActivityLog(max_rows=3)

        log.append("Local", "Image", "Detected", "Image 960 B", "P2S")
        row = log.append(
            "Local",
            "Image",
            "Ignored",
            "Image 960 B",
            "P2S",
            "Duplicate payload",
        )

        rows = log.snapshot()
        self.assertEqual(len(rows), 1)
        self.assertIs(rows[0], row)
        self.assertEqual(rows[0].status, "Suppressed")
        self.assertEqual(rows[0].detail, "Duplicate payload; no resend")


if __name__ == "__main__":
    unittest.main()
