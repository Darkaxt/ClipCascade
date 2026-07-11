import sys
import unittest
from pathlib import Path
from unittest import mock


SRC_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SRC_DIR))

if sys.platform != "win32":
    raise unittest.SkipTest("Windows tray behavior")

from pystray._util import win32  # noqa: E402
from utils.resilient_tray import (  # noqa: E402
    ResilientIcon,
    _checked_notify_icon,
)


class ResilientIconHarness(ResilientIcon):
    def __init__(self, results):
        self._visible = True
        self._running = False
        self._icon_handle = 1
        self._title = "ClipCascade"
        self.results = list(results)
        self.calls = []
        self.released = False

    def _release_icon(self):
        self.released = True

    def _assert_icon_handle(self):
        pass

    def _message(self, code, flags, **kwargs):
        self.calls.append((code, flags, kwargs))
        return self.results.pop(0)


class ResilientTrayTest(unittest.TestCase):
    def test_display_change_modifies_icon_without_deleting_registration(self):
        icon = ResilientIconHarness([True])

        icon._on_display_change(0, 0)

        self.assertTrue(icon.released)
        self.assertEqual([call[0] for call in icon.calls], [win32.NIM_MODIFY])

    def test_display_change_adds_icon_when_modify_reports_missing_registration(self):
        icon = ResilientIconHarness([False, True])

        icon._on_display_change(0, 0)

        self.assertEqual(
            [call[0] for call in icon.calls],
            [win32.NIM_MODIFY, win32.NIM_ADD],
        )

    def test_taskbar_created_adds_icon_without_deleting_registration(self):
        icon = ResilientIconHarness([True])

        icon._on_taskbarcreated(0, 0)

        self.assertEqual([call[0] for call in icon.calls], [win32.NIM_ADD])

    def test_failed_native_registration_is_logged(self):
        with mock.patch(
            "utils.resilient_tray.ctypes.get_last_error",
            return_value=5,
        ), mock.patch(
            "utils.resilient_tray.ctypes.WinError",
            return_value=OSError("native tray failure"),
        ):
            with self.assertLogs("utils.resilient_tray", level="WARNING") as logs:
                result = _checked_notify_icon(
                    lambda _code, _data: False,
                    win32.NIM_ADD,
                    object(),
                    "add",
                )

        self.assertFalse(result)
        self.assertIn("native tray failure", "\n".join(logs.output))


if __name__ == "__main__":
    unittest.main()
