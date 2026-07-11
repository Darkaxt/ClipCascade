# Resilient Windows Tray Design

## Problem

ClipCascade can remain connected and continue syncing while its Windows tray icon disappears. The live process retains both pystray hidden windows, but Windows no longer has the notification-area registration. Sending `TaskbarCreated` restores the icon without restarting the process.

Pystray 0.19.5 handles `WM_DISPLAYCHANGE` by deleting the icon with `NIM_DELETE` and adding it again with `NIM_ADD`. It ignores the `Shell_NotifyIcon` result, so a transient add failure leaves pystray's `visible` state true while the native icon is absent.

## Design

Add a focused Windows-only `ResilientIcon` subclass. It will replace pystray's destructive display-change handler with an in-place `NIM_MODIFY`. If Windows reports that the native entry is missing, it will perform a checked `NIM_ADD`. `TaskbarCreated` will use the same checked registration path.

The wrapper will preserve pystray on macOS and Linux. ClipCascade's tray menu and image handling remain unchanged.

## Error Handling

Every native tray registration call made by the wrapper will inspect the boolean return value. Failures will be logged with the operation and Windows error instead of silently leaving stale state. Recovery is driven by Windows messages and existing icon updates; no polling watchdog is added.

## Testing

Unit tests will inject a fake native notifier and verify:

- A display change modifies an existing icon without deleting it.
- A failed modify falls back to adding the icon.
- A failed add is logged.
- Non-Windows platforms continue using the standard pystray `Icon`.

The packaged client will then be installed and verified by removing the live native registration and sending `TaskbarCreated`; the white clipboard must reappear without changing the process IDs or established connections.
