import os
import json
import logging
import re
import threading
import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass, replace
from typing import Iterable, List, Optional

from PIL import Image


@dataclass(frozen=True)
class ActivityEvent:
    event_id: str
    timestamp: float
    direction: str
    payload_type: str
    status: str
    preview: str
    transport: str = ""
    detail: str = ""
    replayable: bool = False


class ActivityLog:
    DEFAULT_REPLAY_CACHE_LIMIT_BYTES = 8 * 1024 * 1024

    def __init__(
        self,
        max_rows: int = 50,
        replay_cache_limit_bytes: int = DEFAULT_REPLAY_CACHE_LIMIT_BYTES,
    ):
        self.max_rows = max_rows
        self.replay_cache_limit_bytes = max(0, replay_cache_limit_bytes)
        self._rows: List[ActivityEvent] = []
        self._replay_text_by_event_id = OrderedDict()
        self._replay_text_bytes = 0
        self._lock = threading.Lock()

    @staticmethod
    def _is_duplicate_payload(status: str, detail: str) -> bool:
        return (status or "").lower() == "ignored" and "duplicate payload" in (detail or "").lower()

    @staticmethod
    def _matches_detected_duplicate(
        existing: ActivityEvent,
        direction: str,
        payload_type: str,
        preview: str,
        transport: str,
    ) -> bool:
        return (
            existing.direction == direction
            and existing.payload_type == payload_type
            and existing.status == "Detected"
            and existing.preview == preview
            and existing.transport == transport
        )

    def append(
        self,
        direction: str,
        payload_type: str,
        status: str,
        preview: str = "",
        transport: str = "",
        detail: str = "",
        replay_text: Optional[str] = None,
    ) -> ActivityEvent:
        if self._is_duplicate_payload(status, detail):
            status = "Suppressed"
            detail = "Duplicate payload; no resend"

        event = ActivityEvent(
            event_id=uuid.uuid4().hex,
            timestamp=time.time(),
            direction=direction,
            payload_type=payload_type,
            status=status,
            preview=preview or "",
            transport=transport or "",
            detail=detail or "",
        )
        with self._lock:
            if (
                event.direction == "Local"
                and event.status == "Suppressed"
                and self._rows
                and self._matches_detected_duplicate(
                    self._rows[0],
                    event.direction,
                    event.payload_type,
                    event.preview,
                    event.transport,
                )
            ):
                event = replace(event, event_id=self._rows[0].event_id)
                self._rows[0] = event
            else:
                self._rows.insert(0, event)
            del self._rows[self.max_rows :]
            if replay_text is not None:
                self._store_replay_text_locked(event.event_id, replay_text)
            self._prune_replay_text_locked()
            public_event = self._to_public_event_locked(event)
        suffix = f" via {event.transport}" if event.transport else ""
        logging.info(
            "Activity: %s %s %s%s",
            event.direction,
            event.payload_type,
            event.status,
            suffix,
        )
        return public_event

    def _remove_replay_text_locked(self, event_id: str) -> None:
        cached = self._replay_text_by_event_id.pop(event_id, None)
        if cached is not None:
            self._replay_text_bytes -= cached[1]

    def _store_replay_text_locked(self, event_id: str, replay_text: str) -> None:
        self._remove_replay_text_locked(event_id)
        text = str(replay_text)
        size_bytes = len(text.encode("utf-8"))
        if size_bytes > self.replay_cache_limit_bytes:
            return

        self._replay_text_by_event_id[event_id] = (text, size_bytes)
        self._replay_text_bytes += size_bytes
        while self._replay_text_bytes > self.replay_cache_limit_bytes:
            oldest_event_id = next(iter(self._replay_text_by_event_id))
            self._remove_replay_text_locked(oldest_event_id)

    def _prune_replay_text_locked(self) -> None:
        retained_event_ids = {row.event_id for row in self._rows}
        for event_id in list(self._replay_text_by_event_id):
            if event_id not in retained_event_ids:
                self._remove_replay_text_locked(event_id)

    def _to_public_event_locked(self, event: ActivityEvent) -> ActivityEvent:
        replayable = event.event_id in self._replay_text_by_event_id
        if event.replayable == replayable:
            return event
        return replace(event, replayable=replayable)

    def snapshot(self) -> List[ActivityEvent]:
        with self._lock:
            return [self._to_public_event_locked(row) for row in self._rows]

    def get_replay_text(self, event_id: str) -> Optional[str]:
        with self._lock:
            cached = self._replay_text_by_event_id.get(event_id)
            return None if cached is None else cached[0]

    def clear(self) -> None:
        with self._lock:
            self._rows.clear()
            self._replay_text_by_event_id.clear()
            self._replay_text_bytes = 0

    @staticmethod
    def preview_text(payload: object, max_chars: int = 48) -> str:
        text = "" if payload is None else str(payload)
        collapsed = re.sub(r"\s+", " ", text).strip()
        if len(collapsed) > max_chars:
            return collapsed[: max_chars - 3] + "..."
        return collapsed

    @staticmethod
    def format_bytes(size_bytes: Optional[int]) -> str:
        if size_bytes is None:
            return ""
        units = ["B", "KiB", "MiB", "GiB"]
        value = float(size_bytes)
        unit = units[0]
        for unit in units:
            if value < 1024 or unit == units[-1]:
                break
            value /= 1024
        if unit == "B":
            return f"{int(value)} {unit}"
        return f"{value:.1f} {unit}"

    @staticmethod
    def preview_image(img: object, approx_size_bytes: Optional[int] = None) -> str:
        pieces = []
        if isinstance(img, Image.Image):
            pieces.append(f"{img.width}x{img.height}")
        formatted_size = ActivityLog.format_bytes(approx_size_bytes)
        if formatted_size:
            pieces.append(formatted_size)
        if pieces:
            return "Image " + ", ".join(pieces)
        return "Image"

    @staticmethod
    def preview_files(files: object, max_names: int = 2) -> str:
        if isinstance(files, dict):
            names = list(files.keys())
        elif isinstance(files, Iterable) and not isinstance(files, (str, bytes)):
            names = [os.path.basename(str(path)) for path in files]
        else:
            names = []

        count = len(names)
        if count == 0:
            return "Files"

        shown = names[:max_names]
        suffix = f", +{count - max_names} more" if count > max_names else ""
        return f"{count} {'file' if count == 1 else 'files'}: {', '.join(shown)}{suffix}"

    @staticmethod
    def preview_payload(payload: object, payload_type: str) -> str:
        payload_type = (payload_type or "text").lower()
        if payload_type == "text":
            return ActivityLog.preview_text(payload)
        if payload_type == "image":
            approx_size = None
            if isinstance(payload, str):
                approx_size = int(len(payload.encode("utf-8")) * 0.75)
            return ActivityLog.preview_image(None, approx_size)
        if payload_type == "files":
            if isinstance(payload, str):
                try:
                    return ActivityLog.preview_files(json.loads(payload))
                except Exception:
                    return "Files payload"
            return ActivityLog.preview_files(payload)
        return ActivityLog.preview_text(payload)
