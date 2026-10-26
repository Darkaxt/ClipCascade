import ctypes
from ctypes import wintypes
import sys
import tkinter as tk
import unittest

from gui.theme import _apply_windows_frame, apply_theme


@unittest.skipUnless(sys.platform == 'win32' and sys.getwindowsversion().build >= 22000,
                     'Native frame color attributes require Windows 11')
class WindowFrameTest(unittest.TestCase):
    def test_root_and_child_frames_use_app_colors_after_mapping_and_reopening(self):
        root = tk.Tk()
        root.withdraw()
        child = tk.Toplevel(root)
        child.withdraw()
        user32 = ctypes.WinDLL('user32', use_last_error=True)
        user32.GetAncestor.argtypes = [wintypes.HWND, wintypes.UINT]
        user32.GetAncestor.restype = wintypes.HWND
        dwm = ctypes.WinDLL('dwmapi')
        dwm.DwmGetWindowAttribute.argtypes = [wintypes.HWND, wintypes.DWORD,
                                             ctypes.c_void_p, wintypes.DWORD]
        dwm.DwmGetWindowAttribute.restype = ctypes.c_long
        try:
            for window in (root, child):
                apply_theme(window)
                for _ in range(2):
                    window.deiconify()
                    root.update()
                    hwnd = user32.GetAncestor(window.winfo_id(), 2)
                    value = wintypes.DWORD()
                    result = dwm.DwmGetWindowAttribute(hwnd, 20, ctypes.byref(value), ctypes.sizeof(value))
                    self.assertEqual(result, 0)
                    self.assertEqual(value.value, 1, type(window).__name__)
                    # Caption/border colors are documented set-only attributes.
                    self.assertEqual(_apply_windows_frame(window), {20: 0, 34: 0, 35: 0, 36: 0})
                    window.withdraw()
                    root.update()
        finally:
            root.destroy()
