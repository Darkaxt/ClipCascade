from typing import Callable

from utils.activity_log import ActivityLog


class ActivityReplayController:
    def __init__(self, activity_log: ActivityLog, copy_text_locally: Callable[[str], bool]):
        self.activity_log = activity_log
        self.copy_text_locally = copy_text_locally

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
