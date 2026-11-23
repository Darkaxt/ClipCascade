import tkinter as tk
import unittest
from unittest.mock import Mock, patch

from gui.activity import ActivityWindow
from utils.activity_log import ActivityLog


class ActivityWindowTests(unittest.TestCase):
    def test_compact_history_reserves_visible_actions_and_close_keeps_root(self):
        root = tk.Tk()
        root.withdraw()
        log = ActivityLog()
        log.append('Local', 'Text', 'Sent', 'sample', replay_text='sample')
        window = ActivityWindow(log, root, copy_text_locally=Mock(),
                                resend_text=Mock(), is_connected=lambda: True)
        try:
            window.geometry('800x520')
            root.update()
            for button in (window.copy_button, window.resend_button):
                self.assertTrue(button.winfo_ismapped())
                self.assertLessEqual(button.winfo_rooty() + button.winfo_height(),
                                     window.winfo_rooty() + window.winfo_height())
            window.close()
            self.assertTrue(root.winfo_exists())
        finally:
            if window.winfo_exists():
                window.close()
            root.destroy()

    def test_failed_build_destroys_the_partial_window(self):
        root = tk.Tk()
        root.withdraw()
        try:
            with patch.object(ActivityWindow, '_build', side_effect=tk.TclError("can't find ttk.tcl")):
                with self.assertRaises(tk.TclError):
                    ActivityWindow(ActivityLog(), root)
            root.update()
            self.assertEqual([w for w in root.winfo_children() if isinstance(w, tk.Toplevel)], [])
        finally:
            root.destroy()

    def test_resend_button_uses_selected_private_text_and_disables_offline(self):
        root = tk.Tk()
        root.withdraw()
        log = ActivityLog()
        row = log.append('Local', 'Text', 'Sent', 'preview', replay_text='complete text')
        copy = Mock()
        send = Mock(return_value=True)
        connected = Mock(return_value=True)
        window = ActivityWindow(log, root, copy_text_locally=copy,
                                resend_text=send, is_connected=connected)
        window.withdraw()
        try:
            window.tree.selection_set(row.event_id)
            window._on_selection_changed()
            self.assertEqual(str(window.resend_button['state']), 'normal')
            window.resend_button.invoke()
            send.assert_called_once_with('complete text')
            copy.assert_not_called()
            connected.return_value = False
            window.refresh()
            self.assertEqual(str(window.resend_button['state']), 'disabled')
            self.assertEqual(str(window.copy_button['state']), 'normal')
        finally:
            window.close()
            root.destroy()
