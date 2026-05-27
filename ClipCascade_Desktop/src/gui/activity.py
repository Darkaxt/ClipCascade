import time
import tkinter as tk
from tkinter import ttk

from utils.activity_log import ActivityLog
from utils.window_manager import center_window


class ActivityWindow(tk.Tk):
    def __init__(self, activity_log: ActivityLog):
        super().__init__()
        self.activity_log = activity_log

        self.title("ClipCascade Activity")
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
        ttk.Button(actions, text="Refresh", command=self.refresh).pack(side="left", padx=(0, 8))
        ttk.Button(actions, text="Clear", command=self._clear).pack(side="left", padx=(0, 8))
        ttk.Button(actions, text="Close", command=self.destroy).pack(side="left")

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
            self.tree.column(column, width=widths[column], anchor="w", stretch=column in {"preview", "detail"})

        yscroll = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree.yview)
        xscroll = ttk.Scrollbar(table_frame, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=yscroll.set, xscrollcommand=xscroll.set)

        self.tree.grid(row=0, column=0, sticky="nsew")
        yscroll.grid(row=0, column=1, sticky="ns")
        xscroll.grid(row=1, column=0, sticky="ew")
        table_frame.rowconfigure(0, weight=1)
        table_frame.columnconfigure(0, weight=1)

        self.empty_label = ttk.Label(container, text="No clipboard activity yet")
        self.empty_label.pack(pady=(10, 0))

    def _clear(self):
        self.activity_log.clear()
        self.refresh()

    def _refresh_loop(self):
        if self.winfo_exists():
            self.refresh()
            self.after(1000, self._refresh_loop)

    def refresh(self):
        for row_id in self.tree.get_children():
            self.tree.delete(row_id)

        rows = self.activity_log.snapshot()
        for event in rows:
            self.tree.insert(
                "",
                "end",
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

        if rows:
            self.empty_label.pack_forget()
        else:
            if not self.empty_label.winfo_ismapped():
                self.empty_label.pack(pady=(10, 0))
