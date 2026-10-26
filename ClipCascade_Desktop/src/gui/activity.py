import time
import tkinter as tk
from tkinter import ttk, messagebox

from gui.login import HoverTooltip
from gui.theme import COLORS, Icons, apply_theme
from utils.activity_log import ActivityLog
from utils.activity_presentation import filter_activity_events, status_tone
from utils.activity_replay import ActivityReplayController
from utils.window_manager import center_window
from utils.window_icon import apply_clipboard_window_icon, set_windows_app_user_model_id


class ActivityWindow(tk.Toplevel):
    def __init__(self, activity_log: ActivityLog, master=None, on_close=None,
                 copy_text_locally=None, resend_text=None, is_connected=lambda: False,
                 health_snapshot=None, on_reconnect=None, on_account=None, on_logs=None):
        set_windows_app_user_model_id()
        super().__init__(master)
        self.activity_log = activity_log
        self.on_close = on_close
        self.is_connected = is_connected
        self.health_snapshot = health_snapshot or (lambda: {'connected': is_connected()})
        self.on_reconnect, self.on_account, self.on_logs = on_reconnect, on_account, on_logs
        self.replay_controller = ActivityReplayController(activity_log, copy_text_locally, resend_text, is_connected) if copy_text_locally else None
        self._closed = False
        self._view = 'History'
        self._tooltips = []
        self._events = {}
        self._rendered_rows = None
        self._rendered_secondary = None
        self.title('ClipCascade')
        apply_clipboard_window_icon(self)
        self.geometry('1120x680')
        self.minsize(800, 520)
        center_window(self)
        self.style = apply_theme(self)
        self.icons = Icons(self)
        self.query = tk.StringVar(master=self)
        self.filter_mode = 'All'
        self.feedback_text = tk.StringVar(master=self)
        self._build()
        self.query.trace_add('write', lambda *_: self.refresh())
        self.refresh()
        self.protocol("WM_DELETE_WINDOW", self.close)
        self.after(1000, self._refresh_loop)

    def _button(self, parent, icon, label, command, primary=False, icon_only=False):
        button = ttk.Button(parent, text='' if icon_only else label,
                            image=self.icons.get(icon, 'ink' if primary else 'muted'),
                            width=0 if icon_only else 9,
                            compound='left', command=command,
                            style='Accent.TButton' if primary else 'Icon.TButton' if icon_only else 'TButton')
        self._tooltips.append(HoverTooltip(button, label))
        return button

    def _build(self):
        shell = tk.Frame(self, bg=COLORS['background'])
        shell.pack(fill='both', expand=True)
        rail = tk.Frame(shell, width=64, bg=COLORS['surface'])
        rail.pack(side='left', fill='y')
        rail.pack_propagate(False)
        tk.Label(rail, image=self.icons.brand(), bg=COLORS['surface']).pack(pady=(20, 26))
        self.nav_buttons = {}
        for view, icon in [('History', 'history'), ('Health', 'activity'), ('Settings', 'settings-2')]:
            button = self._button(rail, icon, view, lambda value=view: self._show_view(value), icon_only=True)
            button.pack(pady=7, padx=8, fill='x')
            self.nav_buttons[view] = button
        if self.on_account:
            self._button(rail, 'user-round', 'Account', self._account, icon_only=True).pack(side='bottom', pady=18)
        main = ttk.Frame(shell)
        main.pack(side='left', fill='both', expand=True)
        header = ttk.Frame(main, padding=(24, 20, 24, 12))
        header.pack(fill='x')
        self.heading = ttk.Label(header, text='Clipboard history', style='Header.TLabel')
        self.heading.pack(side='left')
        self.connection_label = ttk.Label(header, text='', style='Muted.TLabel')
        self.connection_label.pack(side='right', padx=12)
        self._button(header, 'refresh-cw', 'Refresh view', self.refresh, icon_only=True).pack(side='right')
        self.summary = ttk.Label(main, text='', style='Muted.TLabel', padding=(24, 0, 24, 16))
        self.summary.pack(fill='x')
        self.view_host = ttk.Frame(main)
        self.view_host.pack(fill='both', expand=True)
        self.history = ttk.Frame(self.view_host)
        self.history.pack(fill='both', expand=True)
        tools = ttk.Frame(self.history, padding=(24, 0, 24, 12))
        tools.pack(fill='x')
        ttk.Label(tools, image=self.icons.get('search')).pack(side='left', padx=(0, 10))
        self.search_entry = ttk.Entry(tools, textvariable=self.query)
        self.search_entry.pack(side='left', fill='x', expand=True)
        self._tooltips.append(HoverTooltip(self.search_entry, 'Search clipboard history'))
        self._button(tools, 'trash-2', 'Clear history', self._clear, icon_only=True).pack(side='right', padx=(10, 0))
        filters = ttk.Frame(self.history, padding=(22, 0, 0, 8))
        filters.pack(fill='x')
        self.filter_buttons = {}
        for mode in ('All', 'Text', 'Needs attention'):
            button = ttk.Button(filters, text=mode, style='Tab.TButton', command=lambda value=mode: self._filter(value))
            button.pack(side='left', padx=(0, 8))
            self.filter_buttons[mode] = button
        content = ttk.Frame(self.history)
        content.pack(fill='both', expand=True)
        table_frame = ttk.Frame(content)
        table_frame.pack(side='left', fill='both', expand=True)
        self.tree = ttk.Treeview(table_frame, columns=('time', 'preview', 'status'), show='headings', selectmode='browse')
        for column, title, width in [('time', 'Time', 85), ('preview', 'Clipboard', 330), ('status', 'Status', 125)]:
            self.tree.heading(column, text=title, anchor='w')
            self.tree.column(column, width=width, minwidth=65, stretch=column == 'preview', anchor='w')
        scroll = ttk.Scrollbar(table_frame, orient='vertical', command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        scroll.pack(side='right', fill='y')
        self.tree.pack(fill='both', expand=True)
        self.tree.bind('<<TreeviewSelect>>', self._on_selection_changed)
        self.tree.bind('<Double-1>', self._copy_from_double_click)
        for tone in ('good', 'pending', 'error', 'muted'):
            self.tree.tag_configure(tone, foreground=COLORS[tone])
        self.inspector = tk.Frame(content, width=290, bg=COLORS['surface'], padx=20, pady=20)
        self.inspector.pack(side='right', fill='y')
        self.inspector.pack_configure(before=table_frame)
        self.inspector.pack_propagate(False)
        tk.Label(self.inspector, text='Selected entry', bg=COLORS['surface'], fg=COLORS['muted'], font=('Segoe UI', 10)).pack(anchor='w', pady=(0, 18))
        self.preview_text = tk.Text(self.inspector, height=3, wrap='word', relief='flat', borderwidth=0,
                                    bg=COLORS['surface'], fg=COLORS['text'], font=('Segoe UI', 12),
                                    insertbackground=COLORS['text'], padx=0, pady=0)
        self.preview_text.pack(fill='x')
        self.preview_text.configure(state='disabled')
        self.selected_status = tk.Label(self.inspector, text='', bg=COLORS['surface'], fg=COLORS['text'], font=('Segoe UI', 11), anchor='w')
        self.selected_status.pack(fill='x', pady=(8, 4))
        self.detail_label = tk.Label(self.inspector, text='', bg=COLORS['surface'], fg=COLORS['muted'],
                                     font=('Segoe UI', 10), anchor='nw', justify='left', wraplength=245)
        self.detail_label.pack(fill='both', expand=True)
        actions = tk.Frame(self.inspector, bg=COLORS['surface'])
        actions.pack(fill='x', side='bottom', pady=(8, 0), before=self.inspector.winfo_children()[0])
        self.copy_button = self._button(actions, 'copy', 'Copy', self._copy_selected, primary=True)
        self.copy_button.pack(side='left', fill='x', expand=True, padx=(0, 7))
        self.resend_button = self._button(actions, 'send', 'Resend', self._resend_selected)
        self.resend_button.pack(side='left', fill='x', expand=True)
        self.empty_label = ttk.Label(self.history, text='No matching clipboard activity', style='Muted.TLabel')
        self.secondary = ttk.Frame(self.view_host, padding=(24, 0, 24, 20))
        self.secondary_canvas = tk.Canvas(self.secondary, bg=COLORS['background'], highlightthickness=0, takefocus=True)
        secondary_scroll = ttk.Scrollbar(self.secondary, orient='vertical', command=self.secondary_canvas.yview)
        secondary_scroll.pack(side='right', fill='y')
        self.secondary_canvas.configure(yscrollcommand=secondary_scroll.set)
        self.secondary_canvas.pack(side='left', fill='both', expand=True)
        self.secondary_body = ttk.Frame(self.secondary_canvas)
        self._secondary_item = self.secondary_canvas.create_window((0, 0), window=self.secondary_body, anchor='nw')
        self.secondary_body.bind('<Configure>', lambda _: self.secondary_canvas.configure(scrollregion=self.secondary_canvas.bbox('all')))
        self.secondary_canvas.bind('<Configure>', self._resize_secondary)
        self.secondary_canvas.bind('<Down>', lambda _: self.secondary_canvas.yview_scroll(1, 'units'))
        self.secondary_canvas.bind('<Up>', lambda _: self.secondary_canvas.yview_scroll(-1, 'units'))
        footer = ttk.Frame(main, padding=(24, 9))
        footer.pack(fill='x')
        footer.pack_configure(side='bottom', before=self.view_host)
        self.feedback_label = ttk.Label(footer, textvariable=self.feedback_text, style='Muted.TLabel', wraplength=680)
        self.feedback_label.pack(side='left', fill='x', expand=True)
        ttk.Button(footer, text='Close', command=self.close).pack(side='right')
        self._show_view('History')

    def _filter(self, mode):
        self.filter_mode = mode
        self._rendered_rows = None
        self.refresh()

    def _show_view(self, view):
        self._view = view
        for name, button in self.nav_buttons.items():
            button.configure(style='ActiveIcon.TButton' if name == view else 'Icon.TButton',
                             image=self.icons.get({'History':'history', 'Health':'activity', 'Settings':'settings-2'}[name], 'accent' if name == view else 'muted'))
        self.heading.configure(text={'History':'Clipboard history', 'Health':'Connection health', 'Settings':'Settings'}[view])
        self.history.pack_forget()
        self.secondary.pack_forget()
        if view == 'History':
            self.history.pack(fill='both', expand=True)
        else:
            self.secondary.pack(fill='both', expand=True)
            self._render_secondary()

    def _state(self):
        return self.health_snapshot()

    def _resize_secondary(self, event):
        self.secondary_canvas.itemconfigure(self._secondary_item, width=event.width)
        for label in getattr(self, '_secondary_values', []):
            label.configure(wraplength=max(120, min(470, event.width // 2)))

    def _render_secondary(self):
        for widget in self.secondary_body.winfo_children():
            widget.destroy()
        self._secondary_values = []
        state = self._state()
        self._rendered_secondary = (self._view, state.copy())
        rows = [('Server connection', 'Connected' if state.get('connected') else 'Not connected'),
                ('Clipboard watcher', state.get('capture', 'Not reported')),
                ('Encryption', 'Enabled' if state.get('cipher_enabled') else 'Off'),
                ('Server', state.get('server_url', 'Not reported'))]
        if self._view == 'Settings':
            rows += [('Image sharing', 'Enabled' if state.get('enable_image_sharing') else 'Off'),
                     ('File sharing', 'Enabled' if state.get('enable_file_sharing') else 'Off'),
                     ('Connection notifications', 'Enabled' if state.get('notification') else 'Off'),
                     ('Authentication', state.get('authentication', 'Not reported'))]
        for title, value in rows:
            row = ttk.Frame(self.secondary_body, padding=(0, 18))
            row.pack(fill='x')
            ttk.Label(row, text=title).pack(side='left')
            value_label = ttk.Label(row, text=value, style='Muted.TLabel',
                                    wraplength=max(120, min(470, self.secondary_canvas.winfo_width() // 2)), justify='right')
            value_label.pack(side='right')
            self._secondary_values.append(value_label)
            ttk.Separator(self.secondary_body).pack(fill='x')
        actions = ttk.Frame(self.secondary_body, padding=(0, 24))
        actions.pack(fill='x')
        if self._view == 'Health' and self.on_reconnect:
            self._button(actions, 'refresh-cw', 'Reconnect', self.on_reconnect).pack(side='left', padx=(0, 8))
        if self.on_logs:
            self._button(actions, 'activity', 'Open logs', self.on_logs).pack(side='left', padx=(0, 8))
        if self._view == 'Settings' and self.on_account:
            self._button(actions, 'user-round', 'Sign out', self._account).pack(side='left')
        def bind_wheel(widget):
            widget.bind('<MouseWheel>', lambda event: self.secondary_canvas.yview_scroll(-int(event.delta / 120), 'units'), add='+')
            for child in widget.winfo_children():
                bind_wheel(child)
        bind_wheel(self.secondary_body)

    def _account(self):
        if self.on_account and messagebox.askyesno('Sign out', 'Sign out of ClipCascade on this device?', parent=self):
            self.on_account()

    def _clear(self):
        if not messagebox.askyesno('Clear history', 'Remove clipboard history stored on this device?', parent=self):
            return
        self.activity_log.clear()
        self.feedback_text.set('History cleared')
        self.refresh()

    def _selected_event_id(self):
        selection = self.tree.selection()
        return selection[0] if selection else None

    def _on_selection_changed(self, _event=None):
        event_id = self._selected_event_id()
        event = self._events.get(event_id)
        can_copy = bool(event and self.replay_controller and self.replay_controller.can_replay(event_id))
        self.copy_button.configure(state=tk.NORMAL if can_copy else tk.DISABLED)
        self.resend_button.configure(state=tk.NORMAL if can_copy and self.replay_controller.can_resend(event_id) else tk.DISABLED)
        text = self.activity_log.get_replay_text(event_id) if event else None
        self.preview_text.configure(state='normal')
        self.preview_text.delete('1.0', 'end')
        self.preview_text.insert('1.0', text if text is not None else event.preview if event else 'Select a clipboard entry')
        self.preview_text.configure(state='disabled')
        self.selected_status.configure(text=event.status if event else '', fg=COLORS[status_tone(event.status)] if event else COLORS['muted'])
        self.detail_label.configure(text='\n\n'.join(filter(None, [f'{event.direction} {event.payload_type}', event.transport, event.detail])) if event else '')

    def _resend_selected(self):
        event_id = self._selected_event_id()
        if not event_id or not self.replay_controller:
            return
        result = self.replay_controller.resend(event_id)
        self.feedback_text.set({'requested':'Resend requested - delivery not yet confirmed', 'unavailable':'Clipboard entry is no longer available',
                                'disconnected':'Reconnect before resending', 'send_failed':'Unable to resend - check connection and size limit'}[result])
        self._on_selection_changed()

    def _copy_selected(self):
        event_id = self._selected_event_id()
        if not event_id or not self.replay_controller:
            return
        result = self.replay_controller.replay(event_id)
        self.feedback_text.set({'copied':'Copied locally - not synced', 'unavailable':'Clipboard entry is no longer available', 'write_failed':'Unable to copy clipboard entry'}[result])
        self._on_selection_changed()

    def _copy_from_double_click(self, event):
        event_id = self.tree.identify_row(event.y)
        if event_id:
            self.tree.selection_set(event_id)
            self._copy_selected()

    def _refresh_loop(self):
        if not self._closed and self.winfo_exists():
            self.refresh()
            self.after(1000, self._refresh_loop)

    def refresh(self):
        selected = self._selected_event_id()
        rows = filter_activity_events(self.activity_log.snapshot(), self.query.get(), self.filter_mode)
        self._events = {event.event_id: event for event in rows}
        if rows != self._rendered_rows:
            for row_id in self.tree.get_children():
                self.tree.delete(row_id)
            for event in rows:
                self.tree.insert('', 'end', iid=event.event_id, values=(time.strftime('%H:%M:%S', time.localtime(event.timestamp)),
                                 event.preview or event.detail or event.status, event.status), tags=(status_tone(event.status),))
            self._rendered_rows = rows
            if selected and self.tree.exists(selected):
                self.tree.selection_set(selected)
            elif rows:
                self.tree.selection_set(rows[0].event_id)
        for mode, button in self.filter_buttons.items():
            button.configure(style='ActiveTab.TButton' if mode == self.filter_mode else 'Tab.TButton')
        state = self._state()
        connected = bool(state.get('connected'))
        self.connection_label.configure(text='Connected' if connected else 'Not connected', foreground=COLORS['good'] if connected else COLORS['pending'])
        self.summary.configure(text=f"Capture: {state.get('capture', 'Not reported')}    Encryption: {'enabled' if state.get('cipher_enabled') else 'off'}")
        self._on_selection_changed()
        if self._view == 'History' and not rows:
            self.empty_label.pack(pady=12)
        else:
            self.empty_label.pack_forget()
        if self._view != 'History' and self._rendered_secondary != (self._view, state):
            self._render_secondary()

    def close(self):
        if self._closed:
            return
        self._closed = True
        try:
            self.destroy()
        finally:
            if self.on_close:
                self.on_close()
