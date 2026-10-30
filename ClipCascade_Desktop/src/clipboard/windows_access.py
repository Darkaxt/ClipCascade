"""One exclusive access boundary for this process's Windows clipboard users."""

from contextlib import contextmanager
import io
import threading
import time

from PIL import Image
import pywintypes
import win32clipboard
import win32gui
import win32process


_ACCESS_LOCK = threading.Lock()


class ClipboardBusyError(RuntimeError):
    pass


class ClipboardApplyCancelled(RuntimeError):
    pass


def _holder_detail():
    try:
        hwnd = win32clipboard.GetOpenClipboardWindow()
        if hwnd:
            _thread, pid = win32process.GetWindowThreadProcessId(hwnd)
            return f" (held by PID {pid})"
    except Exception:
        pass  # Diagnostic attribution must not replace the actual access error.
    return " (holder unavailable)"


@contextmanager
def open_clipboard(write=False, wait_for_access=False, cancelled=None, on_acquired=None):
    with _ACCESS_LOCK:
        # SetClipboardData requires an owner window after EmptyClipboard.
        owner = win32gui.CreateWindowEx(
            0, "STATIC", "ClipCascade clipboard", 0, 0, 0, 0, 0, -3, 0, 0, None
        ) if write else 0
        try:
            # Preserve pyperclip's existing external-acquisition budget. Win32
            # exposes no close/availability event, so only failed Open calls poll.
            deadline = None if wait_for_access else time.monotonic() + 0.5
            while True:
                if cancelled and cancelled():
                    raise ClipboardApplyCancelled('Pending clipboard application superseded')
                try:
                    win32clipboard.OpenClipboard(owner)
                    break
                except pywintypes.error as error:
                    if error.winerror not in (0, 5):
                        raise
                    remaining = deadline - time.monotonic() if deadline is not None else None
                    if remaining is not None and remaining <= 0:
                        raise ClipboardBusyError(
                            "Windows clipboard busy; unable to acquire access"
                            + _holder_detail() + f"; native error {error.winerror}"
                        ) from error
                    time.sleep(min(0.01, remaining) if remaining is not None else 0.01)
            try:
                if cancelled and cancelled():
                    raise ClipboardApplyCancelled('Pending clipboard application superseded')
                if on_acquired:
                    on_acquired()
                yield
            finally:
                win32clipboard.CloseClipboard()
        finally:
            if owner:
                win32gui.DestroyWindow(owner)


def read_clipboard(enable_image_monitoring=False, enable_file_monitoring=False):
    image_bytes = None
    with open_clipboard():
        if enable_image_monitoring:
            png = win32clipboard.RegisterClipboardFormat("PNG")
            if win32clipboard.IsClipboardFormatAvailable(png):
                image_bytes = win32clipboard.GetClipboardData(png)
            elif win32clipboard.IsClipboardFormatAvailable(win32clipboard.CF_DIB):
                image_bytes = win32clipboard.GetClipboardData(win32clipboard.CF_DIB)
        if image_bytes is None:
            if win32clipboard.IsClipboardFormatAvailable(win32clipboard.CF_UNICODETEXT):
                return "text", win32clipboard.GetClipboardData(win32clipboard.CF_UNICODETEXT)
            if win32clipboard.IsClipboardFormatAvailable(win32clipboard.CF_TEXT):
                return "text", win32clipboard.GetClipboardData(win32clipboard.CF_TEXT).decode()
            if enable_file_monitoring and win32clipboard.IsClipboardFormatAvailable(
                win32clipboard.CF_HDROP
            ):
                return "files", win32clipboard.GetClipboardData(win32clipboard.CF_HDROP)
            return None, None

    # Decode only after releasing the system clipboard and our access lock.
    with io.BytesIO(image_bytes) as buffer:
        image = Image.open(buffer)
        image.load()
    return "image", image
