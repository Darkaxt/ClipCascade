import os
import json
import logging
import re
import threading
import time
from dataclasses import dataclass
from typing import Iterable, List, Optional

from PIL import Image


@dataclass(frozen=True)
class ActivityEvent:
    timestamp: float
    direction: str
    payload_type: str
    status: str
    preview: str
    transport: str = ""
    detail: str = ""


class ActivityLog:
    def __init__(self, max_rows: int = 50):
        self.max_rows = max_rows
        self._rows: List[ActivityEvent] = []
        self._lock = threading.Lock()

    @staticmethod
    def _is_duplicate_payload(status: str, detail: str) -> bool:
        return (
            (status or "").lower() == "ignored"
            and "duplicate payload" in (detail or "").lower()
        )

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
    ) -> ActivityEvent:
        if self._is_duplicate_payload(status, detail):
            status = "Suppressed"
            detail = "Duplicate payload; no resend"

        event = ActivityEvent(
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
                self._rows[0] = event
            else:
                self._rows.insert(0, event)
            del self._rows[self.max_rows :]
        suffix = f" via {event.transport}" if event.transport else ""
        logging.info(
            "Activity: %s %s %s%s",
            event.direction,
            event.payload_type,
            event.status,
            suffix,
        )
        return event

    def snapshot(self) -> List[ActivityEvent]:
        with self._lock:
            return list(self._rows)

    def clear(self) -> None:
        with self._lock:
            self._rows.clear()

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
