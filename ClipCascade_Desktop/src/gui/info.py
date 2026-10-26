import tkinter as tk
from tkinter import ttk
import gc
import time

from utils.window_manager import center_window
from utils.window_icon import apply_clipboard_window_icon, set_windows_app_user_model_id
from core.constants import *
from gui.theme import COLORS, Icons, apply_theme


class CustomDialog(tk.Tk):
    def __init__(self, message, msg_type="info", timeout=None):
        set_windows_app_user_model_id()
        super().__init__()
        self.message = message
        self.msg_type = msg_type.lower()
        self.timeout = timeout
        self.after_id = None

        self.style = apply_theme(self)
        self.icons = Icons(self)

        self._configure_window()
        self._show_dialog()

        if self.timeout:
            self.after_id = self.after(self.timeout, self.close)

        # Allow closing with keyboard shortcuts
        self.bind("<Return>", lambda e: self.close())
        self.bind("<Escape>", lambda e: self.close())

    def _configure_window(self):
        """Configure the dialog window properties."""
        self.title("ClipCascade")
        try:
            apply_clipboard_window_icon(self)
        except Exception:
            pass
        self.geometry(
            "600x300+{}+{}".format(
                (self.winfo_screenwidth() - 600) // 2,
                (self.winfo_screenheight() - 300) // 2,
            )
        )
        self.update_idletasks()
        center_window(self)
        self.attributes("-topmost", True)
        self.resizable(False, False)
        self.focus_force()

        if PLATFORM == MACOS:
            self.after(100, self._macos_restore_focus)

    def _show_dialog(self):
        """Display the appropriate dialog based on the message type."""
        type_config = {
            "success": ("Success", COLORS['good'], 'check'),
            "error": ("Error", COLORS['error'], 'circle-alert'),
            "warning": ("Warning", COLORS['pending'], 'circle-alert'),
            "info": ("Information", COLORS['accent'], 'info'),
        }
        title, color, symbol = type_config.get(self.msg_type, ("Message", COLORS['text'], 'info'))

        # Create a main frame
        main_frame = ttk.Frame(self, padding="20 20 20 20")
        main_frame.pack(fill="both", expand=True)

        # Title frame with symbol and title
        title_frame = ttk.Frame(main_frame)
        title_frame.pack(pady=(0, 10), fill="x")

        symbol_label = ttk.Label(
            title_frame, image=self.icons.get(symbol), foreground=color
        )
        symbol_label.pack(side="left", padx=(0, 10))

        title_label = ttk.Label(title_frame, text=title, style="Header.TLabel", foreground=color)
        title_label.pack(side="left")

        # Message frame for scrolled text
        message_frame = ttk.Frame(main_frame)
        message_frame.pack(fill="both", expand=True, pady=10)

        # ScrolledText widget for the message
        scroll = ttk.Scrollbar(message_frame, orient='vertical')
        scroll.pack(side='right', fill='y')
        self.text_widget = tk.Text(
            message_frame, wrap="word", font=("Segoe UI", 11), width=70, height=8,
            background=COLORS['field'], foreground=COLORS['text'], relief='flat',
            borderwidth=0, padx=12, pady=12,
            yscrollcommand=scroll.set,
        )
        scroll.configure(command=self.text_widget.yview)
        self.text_widget.pack(fill="both", expand=True)

        # Insert the message and disable editing
        self.text_widget.insert("1.0", self.message)
        self.text_widget.config(state="disabled")

        # Button frame
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(side='bottom', fill='x', pady=(10, 0), before=message_frame)

        ok_button = ttk.Button(button_frame, text="OK", command=self.close, width=10)
        ok_button.pack()
        ok_button.focus_set()

    def _macos_restore_focus(self):
        """Force macOS to properly activate and focus the dialog."""
        try:
            from AppKit import NSApplication
            app = NSApplication.sharedApplication()
            app.activateIgnoringOtherApps_(True)
        except ImportError:
            pass
        self.lift()
        self.focus_force()

    def close(self):
        if self.after_id:
            self.after_cancel(self.after_id)  # Cancel the after event if it exists
            self.after_id = None
        self.destroy()
        gc.collect()
        time.sleep(0.5)
