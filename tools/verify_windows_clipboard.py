"""Exercise the production clipboard path in a private, noninteractive station.

Never run clipboard tests on the user's interactive WinSta0 station.
"""

import ctypes
from ctypes import wintypes
import json
from pathlib import Path
import sys
import threading
import types
from unittest.mock import patch
import uuid


def verify_read_only():
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ClipCascade_Desktop" / "src"))
    import win32clipboard
    import pywintypes
    from clipboard import windows_access as access

    # Associating an OpenClipboard call with a window does not change ownership
    # or content: this mode never invokes EmptyClipboard or a SetClipboard API.
    with access.open_clipboard(write=True):
        pass
    blocked = threading.Event()
    done = threading.Event()
    errors = []
    native_open = win32clipboard.OpenClipboard

    def observe(owner=0):
        try:
            return native_open(owner)
        except pywintypes.error:
            blocked.set()
            raise

    def acquire():
        try:
            with access.open_clipboard(write=True):
                pass
        except Exception as error:
            errors.append(str(error))
        finally:
            done.set()

    native_open()
    with patch.object(win32clipboard, "OpenClipboard", observe):
        worker = threading.Thread(target=acquire)
        worker.start()
        try:
            assert blocked.wait(3), "Did not observe actual native contention"
        finally:
            win32clipboard.CloseClipboard()
        assert done.wait(3), "Acquire did not recover after release"
        worker.join()
    assert not errors, errors
    try:
        with access.open_clipboard(write=True):
            raise RuntimeError("injected operation failure")
    except RuntimeError:
        pass
    with access.open_clipboard():
        pass
    print(json.dumps({
        "ok": True, "mode": "native read-only acquisition",
        "valid_write_owner": True, "contention": "observed and recovered",
        "failure_cleanup": "subsequent native acquire succeeded",
        "clipboard_contents_read": False, "interactive_clipboard_modified": False,
        "native_content_writes_verified": False,
    }, indent=2))


def main():
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    user32.GetProcessWindowStation.restype = wintypes.HANDLE
    user32.CreateWindowStationW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID]
    user32.CreateWindowStationW.restype = wintypes.HANDLE
    user32.SetProcessWindowStation.argtypes = [wintypes.HANDLE]
    user32.CloseWindowStation.argtypes = [wintypes.HANDLE]
    user32.GetThreadDesktop.argtypes = [wintypes.DWORD]
    user32.GetThreadDesktop.restype = wintypes.HANDLE
    user32.CreateDesktopW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.LPVOID,
                                    wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID]
    user32.CreateDesktopW.restype = wintypes.HANDLE
    user32.SetThreadDesktop.argtypes = [wintypes.HANDLE]
    user32.CloseDesktop.argtypes = [wintypes.HANDLE]
    previous = user32.GetProcessWindowStation()
    previous_desktop = user32.GetThreadDesktop(ctypes.windll.kernel32.GetCurrentThreadId())
    desktop = None
    name = "ClipCascadeVerification-" + uuid.uuid4().hex
    station = user32.CreateWindowStationW(name, 0, 0x37F, None)
    if not station:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        if not user32.SetProcessWindowStation(station):
            raise ctypes.WinError(ctypes.get_last_error())
        if user32.GetProcessWindowStation() != station:
            raise RuntimeError("Private clipboard station not active; refusing test")
        desktop = user32.CreateDesktopW("Verification", None, None, 0, 0x1FF, None)
        if not desktop or not user32.SetThreadDesktop(desktop):
            raise ctypes.WinError(ctypes.get_last_error())
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ClipCascade_Desktop" / "src"))
        import win32clipboard
        import pywintypes
        from PIL import Image
        from clipboard import windows_access as access
        from clipboard.clipboard_manager import ClipboardManager
        from utils.activity_log import ActivityLog

        log = ActivityLog()
        manager = ClipboardManager(types.SimpleNamespace(data={}), activity_log=log)
        manager.is_clipboard_size_within_limit = lambda *_: True

        manager.base64_to_clipboard("isolated native text", "text")
        assert access.read_clipboard() == ("text", "isolated native text")

        image = Image.new("RGB", (9, 7), (23, 120, 210))
        encoded = manager.convert_image_to_base64(image)
        manager.base64_to_clipboard(encoded, "image")
        kind, restored = access.read_clipboard(enable_image_monitoring=True)
        assert kind == "image" and restored.size == (9, 7)
        assert restored.getpixel((2, 3)) == (23, 120, 210)

        # Another thread holds the native clipboard without our process lock.
        # Observe the actual failed Open before releasing it, without a sleep.
        win32clipboard.OpenClipboard()
        blocked = threading.Event()
        finished = threading.Event()
        errors = []
        native_open = win32clipboard.OpenClipboard

        def observed_open(owner=0):
            try:
                return native_open(owner)
            except pywintypes.error:
                blocked.set()
                raise

        def write():
            try:
                manager.paste("after external contention", "text")
            except Exception as error:
                errors.append(str(error))
            finally:
                finished.set()

        with patch.object(win32clipboard, "OpenClipboard", observed_open):
            worker = threading.Thread(target=write)
            worker.start()
            try:
                assert blocked.wait(3), "Did not observe native clipboard contention"
            finally:
                win32clipboard.CloseClipboard()
            assert finished.wait(3), "Writer did not recover after lock release"
            worker.join()
        assert not errors, errors
        assert access.read_clipboard() == ("text", "after external contention")

        # A failed Set must release access and not consume image suppression.
        with patch.object(win32clipboard, "SetClipboardData", side_effect=RuntimeError("injected failure")):
            try:
                manager.paste(image, "image")
            except RuntimeError:
                pass
            else:
                raise AssertionError("Injected failure not exercised")
        manager.paste("after failed image", "text")
        assert access.read_clipboard() == ("text", "after failed image")
        print(json.dumps({
            "ok": True, "private_window_station": name,
            "text": "applied and read", "image": "applied and decoded",
            "external_contention": "observed, released, recovered",
            "failed_image": "released; following write succeeded",
            "interactive_clipboard_modified": False,
        }, indent=2))
    finally:
        user32.SetThreadDesktop(previous_desktop)
        if desktop:
            user32.CloseDesktop(desktop)
        user32.SetProcessWindowStation(previous)
        user32.CloseWindowStation(station)


if __name__ == "__main__":
    if sys.argv[1:] == ["--read-only"]:
        verify_read_only()
    elif not sys.argv[1:]:
        main()
    else:
        raise SystemExit("Usage: verify_windows_clipboard.py [--read-only]")
