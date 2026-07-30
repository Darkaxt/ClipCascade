import time
import tkinter as tk
from tkinter import ttk

from utils.activity_log import ActivityLog
from utils.activity_replay import ActivityReplayController
from utils.window_manager import center_window
from utils.window_icon import apply_clipboard_window_icon, set_windows_app_user_model_id


class ActivityWindow(tk.Toplevel):
    def __init__(
        self,
        activity_log: ActivityLog,
        master=None,
        on_close=None,
        copy_text_locally=None,
    ):
        set_windows_app_user_model_id()
        super().__init__(master)
        self.activity_log = activity_log
        self.on_close = on_close
        self.replay_controller = (
            ActivityReplayController(activity_log, copy_text_locally)
            if copy_text_locally is not None
            else None
        )
        self._closed = False

        self.title("ClipCascade Activity")
        try:
            apply_clipboard_window_icon(self)
        except Exception:
            pass
        self.geometry("980x460")
        self.minsize(760, 360)
        center_window(self)

        self.style = ttk.Style(self)
        self.style.configure("TFrame", background="#f5f5f5")
        self.style.configure("TLabel", background="#f5f5f5", font=("Segoe UI", 10))
        self.style.configure("Header.TLabel", font=("Segoe UI", 14, "bold"))
        self.style.configure("TButton", font=("Segoe UI", 10))

        self._build()
        self.refresh()
        self.protocol("WM_DELETE_WINDOW", self.close)
        self.after(1000, self._refresh_loop)

    def _build(self):
        container = ttk.Frame(self, padding="14 14 14 10")
        container.pack(fill="both", expand=True)

        header = ttk.Frame(container)
        header.pack(fill="x", pady=(0, 10))

        title = ttk.Label(header, text="Recent Clipboard Activity", style="Header.TLabel")
        title.pack(side="left")

        actions = ttk.Frame(header)
        actions.pack(side="right")
        self.copy_button = ttk.Button(
            actions,
            text="Copy",
            command=self._copy_selected,
            state=tk.DISABLED,
        )
        self.copy_button.pack(side="left", padx=(0, 8))
        ttk.Button(actions, text="Refresh", command=self.refresh).pack(side="left", padx=(0, 8))
        ttk.Button(actions, text="Clear", command=self._clear).pack(side="left", padx=(0, 8))
        ttk.Button(actions, text="Close", command=self.close).pack(side="left")

        table_frame = ttk.Frame(container)
        table_frame.pack(fill="both", expand=True)

        columns = ("time", "direction", "type", "status", "transport", "preview", "detail")
        self.tree = ttk.Treeview(
            table_frame,
            columns=columns,
            show="headings",
            selectmode="browse",
        )
        headings = {
            "time": "Time",
            "direction": "Direction",
            "type": "Type",
            "status": "Status",
            "transport": "Transport",
            "preview": "Preview",
            "detail": "Detail",
        }
        widths = {
            "time": 90,
            "direction": 85,
            "type": 70,
            "status": 80,
            "transport": 85,
            "preview": 300,
            "detail": 230,
        }
        for column in columns:
            self.tree.heading(column, text=headings[column])
            self.tree.column(
                column, width=widths[column], anchor="w", stretch=column in {"preview", "detail"}
            )

        yscroll = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree.yview)
        xscroll = ttk.Scrollbar(table_frame, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=yscroll.set, xscrollcommand=xscroll.set)
        self.tree.bind("<<TreeviewSelect>>", self._on_selection_changed)
        self.tree.bind("<Double-1>", self._copy_from_double_click)

        self.tree.grid(row=0, column=0, sticky="nsew")
        yscroll.grid(row=0, column=1, sticky="ns")
        xscroll.grid(row=1, column=0, sticky="ew")
        table_frame.rowconfigure(0, weight=1)
        table_frame.columnconfigure(0, weight=1)

        self.feedback_text = tk.StringVar(value="")
        self.feedback_label = ttk.Label(container, textvariable=self.feedback_text)
        self.feedback_label.pack(pady=(8, 0))

        self.empty_label = ttk.Label(container, text="No clipboard activity yet")
        self.empty_label.pack(pady=(10, 0))

    def _clear(self):
        self.activity_log.clear()
        self.feedback_text.set("")
        self.refresh()

    def _selected_event_id(self):
        selected = self.tree.selection()
        return selected[0] if selected else None

    def _on_selection_changed(self, _event=None):
        event_id = self._selected_event_id()
        can_replay = (
            event_id is not None
            and self.replay_controller is not None
            and self.replay_controller.can_replay(event_id)
        )
        self.copy_button.configure(state=tk.NORMAL if can_replay else tk.DISABLED)

    def _copy_selected(self):
        event_id = self._selected_event_id()
        if event_id is None or self.replay_controller is None:
            return

        result = self.replay_controller.replay(event_id)
        messages = {
            "copied": "Copied locally - not synced",
            "unavailable": "Clipboard entry is no longer available",
            "write_failed": "Unable to copy clipboard entry",
        }
        self.feedback_text.set(messages[result])
        self._on_selection_changed()

    def _copy_from_double_click(self, event):
        event_id = self.tree.identify_row(event.y)
        if event_id:
            self.tree.selection_set(event_id)
            self._copy_selected()

    def _refresh_loop(self):
        if self.winfo_exists():
            self.refresh()
            self.after(1000, self._refresh_loop)

    def refresh(self):
        selected_event_id = self._selected_event_id()
        for row_id in self.tree.get_children():
            self.tree.delete(row_id)

        rows = self.activity_log.snapshot()
        for event in rows:
            self.tree.insert(
                "",
                "end",
                iid=event.event_id,
                values=(
                    time.strftime("%H:%M:%S", time.localtime(event.timestamp)),
                    event.direction,
                    event.payload_type,
                    event.status,
                    event.transport,
                    event.preview,
                    event.detail,
                ),
            )

        if selected_event_id and self.tree.exists(selected_event_id):
            self.tree.selection_set(selected_event_id)
        self._on_selection_changed()

        if rows:
            self.empty_label.pack_forget()
        else:
            if not self.empty_label.winfo_ismapped():
                self.empty_label.pack(pady=(10, 0))

    def close(self):
        if self._closed:
            return

        self._closed = True
        try:
            self.destroy()
        finally:
            if self.on_close:
                self.on_close()
