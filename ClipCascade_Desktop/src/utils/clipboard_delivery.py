"""Bounded, connection-local application acknowledgements, separate from echoes."""

from collections import OrderedDict
import hashlib
import threading
import time
import uuid


class ClipboardDelivery:
    def __init__(self):
        self._lock = threading.RLock()
        self.reset()

    @staticmethod
    def fingerprint(payload, type_):
        return hashlib.sha256((type_ + '\0' + payload).encode('utf-8')).hexdigest()

    def reset(self):
        with self._lock:
            self.pending = OrderedDict()
            self.applied = OrderedDict()
            self.latest_id = None
            self.wire_body = None

    def retry_body(self, payload, type_):
        with self._lock:
            state = self.pending.get(self.latest_id)
            if state and not state[2] and state[0] == self.fingerprint(payload, type_):
                return self.wire_body
            return None

    def remember_body(self, body):
        with self._lock:
            self.wire_body = body

    def begin(self, payload, type_):
        with self._lock:
            id_ = str(uuid.uuid4())
            self.pending[id_] = [self.fingerprint(payload, type_), time.monotonic(), False, type_]
            self.latest_id = id_
            self.wire_body = None
            self._trim(self.pending)
            return id_

    def should_suppress(self, payload, type_):
        with self._lock:
            state = self.pending.get(self.latest_id)
            return bool(state and state[2] and state[0] == self.fingerprint(payload, type_)
                        and time.monotonic() - state[1] < 5)

    def acknowledge(self, message):
        with self._lock:
            if message.get('protocol') == 1 and message.get('kind') == 'clipboard_delivery_reset':
                self.pending.clear()
                self.latest_id = None
                self.wire_body = None
                return None
            if message.get('protocol') != 1 or message.get('kind') != 'clipboard_delivery':
                return None
            state = self.pending.get(message.get('deliveryId'))
            expected, applied = message.get('expected'), message.get('applied')
            if (state is None or state[2] or message.get('complete') is not True
                    or type(expected) is not int or expected <= 0 or applied != expected):
                return None
            state[2] = True
            return state[3]

    def was_applied(self, key, fingerprint):
        with self._lock:
            return self.applied.get(key) == fingerprint

    def mark_applied(self, key, fingerprint):
        with self._lock:
            self.applied[key] = fingerprint
            self._trim(self.applied)

    @staticmethod
    def _trim(states):
        while len(states) > 128:
            states.popitem(last=False)
