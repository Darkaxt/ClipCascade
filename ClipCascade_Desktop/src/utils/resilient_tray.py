import ctypes
import logging
import sys

from pystray import Icon as PystrayIcon


logger = logging.getLogger(__name__)


def _checked_notify_icon(notifier, code, data, operation):
    if notifier(code, data):
        return True

    error_code = ctypes.get_last_error()
    error = ctypes.WinError(error_code) if error_code else OSError(
        "Shell_NotifyIcon returned false"
    )
    logger.warning("Windows tray %s failed: %s", operation, error)
    return False


if sys.platform == "win32":
    from pystray._util import win32

    class ResilientIcon(PystrayIcon):
        """Pystray icon that keeps native Windows registration in sync."""

        def _message(self, code, flags, **kwargs):
            data = win32.NOTIFYICONDATAW(
                cbSize=ctypes.sizeof(win32.NOTIFYICONDATAW),
                hWnd=self._hwnd,
                hID=id(self),
                uFlags=flags,
                **kwargs,
            )
            operation = {
                win32.NIM_ADD: "add",
                win32.NIM_MODIFY: "modify",
                win32.NIM_DELETE: "delete",
            }.get(code, str(code))
            return _checked_notify_icon(
                win32.Shell_NotifyIcon,
                code,
                data,
                operation,
            )

        def _add_registration(self):
            self._assert_icon_handle()
            return self._message(
                win32.NIM_ADD,
                win32.NIF_MESSAGE | win32.NIF_ICON | win32.NIF_TIP,
                uCallbackMessage=win32.WM_NOTIFY,
                hIcon=self._icon_handle,
                szTip=self.title,
            )

        def _show(self):
            return self._add_registration()

        def _update_icon(self):
            self._release_icon()
            self._assert_icon_handle()

            if not self.visible:
                self._icon_valid = True
                return

            updated = self._message(
                win32.NIM_MODIFY,
                win32.NIF_ICON,
                hIcon=self._icon_handle,
            )
            if not updated:
                updated = self._add_registration()
            self._icon_valid = updated

        def _on_display_change(self, wparam, lparam):
            if self.visible:
                self._update_icon()

        def _on_taskbarcreated(self, wparam, lparam):
            if self.visible:
                self._add_registration()

else:
    ResilientIcon = PystrayIcon
