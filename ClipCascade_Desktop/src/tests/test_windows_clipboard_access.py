import importlib.util
import io
import sys
import threading
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from PIL import Image


SRC = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SRC))


class NativeError(Exception):
    def __init__(self, code):
        self.winerror = code
        super().__init__(code, "OpenClipboard", "native failure")


def load_access():
    clipboard = Mock()
    clipboard.CF_UNICODETEXT = 13
    clipboard.CF_TEXT = 1
    clipboard.CF_DIB = 8
    clipboard.CF_HDROP = 15
    clipboard.RegisterClipboardFormat.return_value = 49152
    clipboard.GetOpenClipboardWindow.return_value = 456
    gui = Mock()
    gui.CreateWindowEx.return_value = 123
    process = Mock()
    process.GetWindowThreadProcessId.return_value = (7, 99)
    spec = importlib.util.spec_from_file_location(
        "windows_access_under_test", SRC / "clipboard" / "windows_access.py"
    )
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {
        "win32clipboard": clipboard, "win32gui": gui,
        "win32process": process, "pywintypes": types.SimpleNamespace(error=NativeError),
    }):
        spec.loader.exec_module(module)
    return module, clipboard, gui


class WindowsClipboardAccessTest(unittest.TestCase):
    def setUp(self):
        self.access, self.clipboard, self.gui = load_access()

    def test_writer_uses_owner_and_releases_clipboard_on_set_failure(self):
        self.clipboard.SetClipboardText.side_effect = RuntimeError("set failed")
        with self.assertRaisesRegex(RuntimeError, "set failed"):
            with self.access.open_clipboard(write=True):
                self.clipboard.SetClipboardText("text", 13)
        self.clipboard.OpenClipboard.assert_called_once_with(123)
        self.clipboard.CloseClipboard.assert_called_once()
        self.gui.DestroyWindow.assert_called_once_with(123)

    def test_busy_open_recovers_without_repeating_the_write(self):
        self.clipboard.OpenClipboard.side_effect = [NativeError(5), None]
        with patch.object(self.access.time, "sleep") as sleep:
            with self.access.open_clipboard(write=True):
                self.clipboard.SetClipboardText("text", 13)
        self.assertEqual(self.clipboard.OpenClipboard.call_count, 2)
        self.clipboard.SetClipboardText.assert_called_once()
        self.clipboard.CloseClipboard.assert_called_once()
        sleep.assert_called_once()

    def test_busy_error_zero_is_not_reported_as_success(self):
        self.clipboard.OpenClipboard.side_effect = NativeError(0)
        with patch.object(self.access.time, "monotonic", side_effect=[0.0, 0.6]):
            with self.assertRaisesRegex(self.access.ClipboardBusyError, "PID 99"):
                with self.access.open_clipboard(write=True):
                    self.fail("Failed open must not execute the write")
        self.clipboard.CloseClipboard.assert_not_called()
        self.gui.DestroyWindow.assert_called_once_with(123)

    def test_non_contention_error_is_not_retried(self):
        self.clipboard.OpenClipboard.side_effect = NativeError(1400)
        with patch.object(self.access.time, "sleep") as sleep:
            with self.assertRaises(NativeError):
                with self.access.open_clipboard():
                    self.fail("Invalid handle must not execute the operation")
        self.clipboard.OpenClipboard.assert_called_once()
        sleep.assert_not_called()

    def test_reader_waits_for_internal_writer_before_opening(self):
        attempted = threading.Event()
        entered = threading.Event()
        finished = threading.Event()

        def read():
            attempted.set()
            with self.access.open_clipboard():
                entered.set()
            finished.set()

        with self.access.open_clipboard(write=True):
            worker = threading.Thread(target=read)
            worker.start()
            self.assertTrue(attempted.wait(2))
            self.assertFalse(entered.is_set())
            self.clipboard.OpenClipboard.assert_called_once_with(123)
        self.assertTrue(finished.wait(2))
        worker.join()
        self.assertTrue(entered.is_set())
        self.assertEqual(self.clipboard.CloseClipboard.call_count, 2)

    def test_read_text_closes_before_returning(self):
        self.clipboard.IsClipboardFormatAvailable.side_effect = lambda fmt: fmt == 13
        self.clipboard.GetClipboardData.return_value = "read text"
        self.assertEqual(self.access.read_clipboard(), ("text", "read text"))
        self.clipboard.CloseClipboard.assert_called_once()

    def test_read_dib_keeps_image_valid_after_clipboard_close(self):
        buffer = io.BytesIO()
        Image.new("RGB", (3, 2), (12, 34, 56)).save(buffer, format="DIB")
        self.clipboard.IsClipboardFormatAvailable.side_effect = lambda fmt: fmt == 8
        self.clipboard.GetClipboardData.return_value = buffer.getvalue()
        kind, image = self.access.read_clipboard(enable_image_monitoring=True)
        self.assertEqual(kind, "image")
        self.assertEqual(image.getpixel((1, 1)), (12, 34, 56))
        self.clipboard.CloseClipboard.assert_called_once()

    def test_read_exception_still_releases_clipboard(self):
        self.clipboard.IsClipboardFormatAvailable.side_effect = lambda fmt: fmt == 13
        self.clipboard.GetClipboardData.side_effect = RuntimeError("read failed")
        with self.assertRaisesRegex(RuntimeError, "read failed"):
            self.access.read_clipboard()
        self.clipboard.CloseClipboard.assert_called_once()

    def test_png_and_files_keep_their_capture_types(self):
        buffer = io.BytesIO()
        Image.new("RGB", (4, 3)).save(buffer, format="PNG")
        self.clipboard.IsClipboardFormatAvailable.side_effect = lambda fmt: fmt == 49152
        self.clipboard.GetClipboardData.return_value = buffer.getvalue()
        kind, image = self.access.read_clipboard(enable_image_monitoring=True)
        self.assertEqual((kind, image.size), ("image", (4, 3)))
        self.clipboard.IsClipboardFormatAvailable.side_effect = lambda fmt: fmt == 15
        self.clipboard.GetClipboardData.return_value = ("example.txt",)
        self.assertEqual(
            self.access.read_clipboard(enable_file_monitoring=True),
            ("files", ("example.txt",)),
        )

    def test_failed_native_read_does_not_escape_or_disable_next_callback(self):
        spec = importlib.util.spec_from_file_location(
            "monitor_under_test", SRC / "clipboard" / "clipboard_monitor_win.py"
        )
        monitor = importlib.util.module_from_spec(spec)
        dependency = types.SimpleNamespace(read_clipboard=Mock())
        with patch.dict(sys.modules, {"clipboard.windows_access": dependency}):
            spec.loader.exec_module(monitor)
        monitor._callback_update = Mock()
        monitor.read_clipboard.side_effect = [RuntimeError("clipboard busy"), ("text", "next")]
        with self.assertLogs(level="ERROR"):
            self.assertEqual(monitor._process_message(0, 0x031D, 0, 0), 0)
        self.assertEqual(monitor._process_message(0, 0x031D, 0, 0), 0)
        monitor._callback_update.assert_called_once_with("text", "next")


if __name__ == "__main__":
    unittest.main()
