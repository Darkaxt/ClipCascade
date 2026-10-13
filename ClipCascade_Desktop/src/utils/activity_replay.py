from typing import Callable

from utils.activity_log import ActivityLog


class ActivityReplayController:
    def __init__(self, activity_log: ActivityLog, copy_text_locally: Callable[[str], bool],
                 resend_text=None, is_connected=lambda: False):
        self.activity_log = activity_log
        self.copy_text_locally = copy_text_locally
        self.resend_text = resend_text
        self.is_connected = is_connected

    def can_resend(self, event_id: str) -> bool:
        return self.can_replay(event_id) and self.resend_text is not None and self.is_connected()

    def resend(self, event_id: str) -> str:
        if not self.can_replay(event_id):
            return "unavailable"
        if self.resend_text is None or not self.is_connected():
            return "disconnected"
        content = self.activity_log.get_replay_text(event_id)
        if content is None:
            return "unavailable"
        try:
            return "requested" if self.resend_text(content) else "send_failed"
        except Exception:
            return "send_failed"

    def can_replay(self, event_id: str) -> bool:
        return any(
            row.event_id == event_id and row.payload_type.lower() == "text" and row.replayable
            for row in self.activity_log.snapshot()
        )

    def replay(self, event_id: str) -> str:
        if not self.can_replay(event_id):
            return "unavailable"

        content = self.activity_log.get_replay_text(event_id)
        if content is None:
            return "unavailable"

        return "copied" if self.copy_text_locally(content) else "write_failed"
