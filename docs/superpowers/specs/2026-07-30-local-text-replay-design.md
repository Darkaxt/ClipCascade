# Local Text Replay Design

## Goal

Allow Android and Windows users to restore a text value from Recent Clipboard Activity to the current device clipboard without sending it to any other ClipCascade client.

## Scope

- Text events only.
- Android and Windows clients.
- Memory-only history; nothing new is persisted.
- Existing image, file, and system rows remain non-replayable.
- Restored text is explicitly excluded from outbound synchronization.

## Architecture

Each activity store keeps replay text in a private payload cache keyed by event ID. Public event snapshots expose only a `replayable` flag and retain the existing preview-only privacy contract. The cache holds at most 8 MiB of UTF-8 text; when the budget is exceeded, oldest replay payloads are evicted while their activity rows remain visible.

Replaying an event creates a one-shot local-write guard containing the text hash, then writes the text to the operating-system clipboard. The next matching watcher event consumes the guard without invoking the outbound send path. This guard is independent of the normal duplicate detector and does not use a cancellation timeout.

## Interaction

- Android shows a copy icon on replayable text rows and a short `Copied locally - not synced` confirmation.
- Windows enables a `Copy` command for a selected replayable text row; double-click invokes the same command.
- Non-replayable rows do not expose an active copy action.
- Clearing activity also clears cached replay payloads.

## Failure Handling

- An evicted or missing payload returns a clear unavailable result and does not alter the clipboard.
- A clipboard write failure is shown in the client UI and leaves normal synchronization active.
- Consuming a replay guard suppresses only the exact next matching local text event.

## Verification

- Unit tests prove payloads remain private, enforce the byte budget, clear correctly, and consume the local-only guard once.
- Android and Windows UI tests prove only replayable text can invoke the local-copy callback.
- Device smoke tests prove Android replay does not reach Windows and Windows replay does not reach Android, while ordinary copies still sync.
