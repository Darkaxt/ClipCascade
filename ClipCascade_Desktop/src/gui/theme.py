"""Native Control Room colors and packaged Lucide control artwork."""
import ctypes
from ctypes import wintypes
import logging
import sys
import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk
from utils.window_icon import _asset_path

COLORS = dict(background='#1f1e1e', surface='#252424', raised='#2e2d2d', text='#f9f7f6',
              muted='#b9b7b6', line='#41403f', accent='#72d6e5', selection='#253a3e',
              good='#9bdfb0', pending='#f1cc79', error='#ffaaa5', ink='#102f34', field='#191919')


def _apply_windows_frame(window):
    if sys.platform != 'win32':
        return
    user32 = ctypes.WinDLL('user32', use_last_error=True)
    user32.GetAncestor.argtypes = [wintypes.HWND, wintypes.UINT]
    user32.GetAncestor.restype = wintypes.HWND
    dwm = ctypes.WinDLL('dwmapi')
    dwm.DwmSetWindowAttribute.argtypes = [wintypes.HWND, wintypes.DWORD,
                                         ctypes.c_void_p, wintypes.DWORD]
    dwm.DwmSetWindowAttribute.restype = ctypes.c_long
    # Tk's content HWND is a child of the decorated native top-level HWND.
    hwnd = user32.GetAncestor(window.winfo_id(), 2)
    attributes = {20: 1, 34: COLORS['line'], 35: COLORS['background'], 36: COLORS['text']}
    results = {}
    for attribute, color in attributes.items():
        value = wintypes.DWORD(color if isinstance(color, int) else
                               int.from_bytes(bytes.fromhex(color[1:]), 'little'))
        result = dwm.DwmSetWindowAttribute(hwnd, attribute, ctypes.byref(value), ctypes.sizeof(value))
        results[attribute] = result
        if result < 0:
            logging.debug('Window frame attribute %s unavailable: HRESULT %#x', attribute, result & 0xffffffff)
    return results


def apply_theme(window):
    window.configure(background=COLORS['background'])
    # Map also covers native handles recreated after withdraw/deiconify.
    if sys.platform == 'win32' and not getattr(window, '_clipcascade_frame_theme', False):
        window.bind('<Map>', lambda event: _apply_windows_frame(window) if event.widget is window else None, add='+')
        window._clipcascade_frame_theme = True
        if window.winfo_ismapped():
            _apply_windows_frame(window)
    style = ttk.Style(window)
    style.theme_use('clam')
    style.configure('.', background=COLORS['background'], foreground=COLORS['text'], font=('Segoe UI', 11),
                    bordercolor=COLORS['line'], lightcolor=COLORS['line'], darkcolor=COLORS['line'],
                    focuscolor=COLORS['accent'])
    style.configure('TFrame', background=COLORS['background'])
    style.configure('TLabel', background=COLORS['background'], foreground=COLORS['text'])
    style.configure('Muted.TLabel', foreground=COLORS['muted'])
    style.configure('Header.TLabel', font=('Segoe UI', 19, 'bold'))
    style.configure('TEntry', fieldbackground=COLORS['field'], foreground=COLORS['text'],
                    insertcolor=COLORS['text'], bordercolor=COLORS['line'], padding=9)
    style.map('TEntry', bordercolor=[('focus', COLORS['accent'])],
              lightcolor=[('focus', COLORS['accent'])], darkcolor=[('focus', COLORS['accent'])])
    style.configure('TButton', background=COLORS['raised'], foreground=COLORS['text'],
                    bordercolor=COLORS['line'], padding=(12, 9))
    style.map('TButton', background=[('active', COLORS['selection'])], foreground=[('disabled', '#777777')])
    style.configure('Accent.TButton', background=COLORS['accent'], foreground=COLORS['ink'])
    style.map('Accent.TButton', background=[('active', '#98e4ed')], foreground=[('disabled', '#657f83')])
    style.configure('Icon.TButton', padding=10, borderwidth=0, background=COLORS['surface'])
    style.configure('ActiveIcon.TButton', padding=10, borderwidth=0, background=COLORS['selection'])
    style.configure('Tab.TButton', borderwidth=0, background=COLORS['background'], foreground=COLORS['muted'])
    style.configure('ActiveTab.TButton', borderwidth=0, background=COLORS['selection'], foreground=COLORS['accent'])
    style.configure('Treeview', background=COLORS['background'], fieldbackground=COLORS['background'],
                    foreground=COLORS['text'], borderwidth=0, rowheight=59)
    style.map('Treeview', background=[('selected', COLORS['selection'])], foreground=[('selected', COLORS['text'])])
    style.configure('Treeview.Heading', background=COLORS['surface'], foreground=COLORS['muted'],
                    relief='flat', font=('Segoe UI', 10), padding=(10, 12))
    style.configure('TCheckbutton', foreground=COLORS['text'], background=COLORS['background'], padding=6)
    style.map('TCheckbutton', indicatorbackground=[('selected', COLORS['accent']), ('!selected', COLORS['field'])],
              indicatorforeground=[('selected', COLORS['ink'])])
    style.configure('Vertical.TScrollbar', background=COLORS['raised'], troughcolor=COLORS['background'],
                    arrowcolor=COLORS['muted'], borderwidth=0)
    style.map('Vertical.TScrollbar', background=[('active', COLORS['line']), ('pressed', COLORS['muted'])])
    style.configure('TSeparator', background=COLORS['line'])
    return style


class Icons:
    def __init__(self, master):
        self.master = master
        self.images = {}

    def get(self, name, tone='muted'):
        key = (name, tone)
        if key not in self.images:
            self.images[key] = tk.PhotoImage(master=self.master, file=str(_asset_path('logo', 'ui', name+'-'+tone+'.png')))
        return self.images[key]

    def brand(self, size=34):
        key = ('brand', size)
        if key not in self.images:
            with Image.open(_asset_path('logo', 'window-icon.png')) as image:
                self.images[key] = ImageTk.PhotoImage(image.resize((size, size), Image.Resampling.LANCZOS), master=self.master)
        return self.images[key]
