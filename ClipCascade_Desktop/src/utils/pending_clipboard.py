"""One supersedable native clipboard acquisition, never a transport retry loop."""

from threading import Lock, Thread
import logging


class PendingClipboard:
    def __init__(self):
        self._lock = Lock()
        self._generation = 0
        self._pending = None
        self._active_key = None
        self._thread = None

    def contains(self, key):
        with self._lock:
            return self._active_key == key or bool(self._pending and self._pending[1] == key)

    def cancel(self):
        with self._lock:
            self._generation += 1
            self._pending = None
            self._active_key = None
            return self._generation

    def is_current(self, generation):
        with self._lock:
            return generation == self._generation

    def defer(self, generation, key, apply):
        with self._lock:
            if generation != self._generation:
                return
            self._pending = (generation, key, apply)
            if self._thread is None:
                self._thread = Thread(target=self._run, name='ClipCascade-clipboard-apply', daemon=True)
                self._thread.start()

    def _run(self):
        while True:
            with self._lock:
                job, self._pending = self._pending, None
                if job is None:
                    self._thread = None
                    return
                generation, key, apply = job
                self._active_key = key
            try:
                apply(lambda: not self.is_current(generation))
            except Exception:
                logging.exception('Pending clipboard worker failed')
            finally:
                with self._lock:
                    if generation == self._generation:
                        self._active_key = None
