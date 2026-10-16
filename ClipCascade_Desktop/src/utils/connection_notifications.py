from threading import RLock, Timer

from core.constants import APP_NAME


class ConnectionNotifications:
    """Debounce notifications only, independently of transport recovery."""

    def __init__(self, notify, grace_seconds, timer_factory=Timer):
        self._notify = notify
        self._grace_seconds = grace_seconds
        self._timer_factory = timer_factory
        self._lock = RLock()
        self._down = False
        self._warned = False
        self._timer = None
        self._token = None

    def _cancel(self):
        self._token = None
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None

    def _schedule(self, recovery):
        token = self._token = object()

        def announce():
            with self._lock:
                if self._token is not token or self._down == recovery:
                    return
                self._token = None
                self._timer = None
                self._warned = not recovery
                self._notify(
                    title=f"{APP_NAME}: WebSocket Connection {'Restored' if recovery else 'Lost'}",
                    message=("Connection re-established" if recovery else
                             "Check your internet connection. Retrying..."),
                )

        if self._grace_seconds == 0:
            announce()
        else:
            self._timer = self._timer_factory(self._grace_seconds, announce)
            self._timer.daemon = True
            self._timer.start()

    def lost(self):
        with self._lock:
            if self._down:
                return
            self._down = True
            self._cancel()
            if not self._warned:
                self._schedule(recovery=False)

    def connected(self):
        with self._lock:
            if not self._down:
                return
            self._down = False
            self._cancel()
            if self._warned:
                self._schedule(recovery=True)

    def reset(self):
        with self._lock:
            self._cancel()
            self._down = False
            self._warned = False
