import tkinter as tk
import unittest
from unittest.mock import Mock

from gui.activity import ActivityWindow
from utils.activity_log import ActivityLog


class ActivityWindowTests(unittest.TestCase):
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
