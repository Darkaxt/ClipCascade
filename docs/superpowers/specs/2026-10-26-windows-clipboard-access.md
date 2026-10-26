# Windows Clipboard Access Repair

Authorization: user requested fixing the received-but-not-applied Windows errors.
Normal release and local Windows delivery are authorized; Android is unchanged.

## Requirements

- W1: Coordinate Windows clipboard reads and text/image writes through one
  process-wide lock. Never hold the clipboard while calling transport callbacks.
  Remove the unconditional pre-read sleep; wait only at the exclusive Win32 API
  boundary when OpenClipboard reports contention.
- W2: Close every successful open in finally, including Empty/Set failures.
  Use a valid owner window for writes. Set image watcher suppression only after
  a successful image write. Keep native/other-platform behavior otherwise intact.
- W3: Use the existing text writer's 0.5-second acquisition budget and 10 ms
  polling only for external Win32 contention (Win32 has no clipboard-close event).
  Internal lock waits are event-driven, without a deadline. Exhaustion reports
  clipboard busy, not misleading WinError 0 success, with lock-holder PID when
  identifiable. Non-contention errors are not retried. Failed reads cannot escape
  the native window callback or permanently disable monitoring.
- W4: Verify regression cases for text/image writes and native clipboard access
  and contention without modifying the interactive clipboard. Preserve deduplication, replay, transport,
  credentials, DATA and existing tray/window icons.
- W5: Publish a matching Windows-only release; independently download and verify
  PE version, digest and packaged code. Request graceful local shutdown first;
  if teardown demonstrably stalls, preserve diagnostics and DATA before stopping
  only the verified old process for replacement. Install locally,
  preserve DATA and verify a fresh production Client Alive ACK. Do not claim an
  ACK proves clipboard application. No Android/server installation or changes.

## Stages

1. Integrated Windows clipboard access repair: COMPLETE (W1-W4).
   Acceptance: focused regression tests and isolated native Windows verification.
   Verified: full desktop suite passed; expanded focused access tests passed.
   Real read-only native owner-window acquisition, observed contention/recovery
   and post-failure reacquisition passed, without reading or altering content.
   Regression first reproduced missing CloseClipboard on image Set failure.
   PNG/DIB/text/files and native callback read-failure survival are covered.
   No material design debt within scope; one shared acquisition boundary replaces
   the competing pyperclip/direct writes and uncoordinated monitor reads.
   No blockers or deferrals remain in this stage.
2. Windows release and local activation: COMPLETE (W5).
   Acceptance: published/downloaded/installed artifact identity and fresh ACK.
   Verified: normal published Windows release 3.2.0.32 targets source commit
   395e21c387bee96aed1acd0e0110d0a255a2cb59. Independently retrieved EXE matches
   the built and installed artifact, PE version 3.2.0.32, 57,964,640 bytes,
   SHA256 1bd33fc7656c377eabdeef03926bafc5bef3a427e89d12ee3232b3d8ff2682e3.
   Packaged clipboard modules/constants match verified source and icons match
   maintained assets. Version consistency CI passed.
   Saved DATA digest is unchanged. Exactly one installed bootloader/app pair
   runs; a fresh session-bound Windows 3.2.0.32 Client Alive ACK was independently
   read back at 2026-10-26T00:43:07.664642153Z. This is transport/control evidence,
   not proof of remote clipboard application. Android/server are untouched.
   No requirement blockers or tracked deferrals remain.

No tracked deferrals.

Verification detail: creating the private native window station failed with
WinError 5 (Windows access denied, not a tool-policy rejection). Do not alter
permissions or replay station creation. Native verification instead exercises
the actual owner-window Open/Close, contention and failure-cleanup boundary in
read-only mode. Text/image Set failures and format handling use fault injection;
physical native content writes are not claimed. This preserves the original
no-interactive-clipboard-mutation constraint and product behavior requirements.

Local replacement detail: the native tray-loop stop disconnected the old client,
but bypassed its normal Quit callback and left Python in ImageTk.__del__ during
teardown. A read-only stack capture found only the old main thread at that call.
After confirming executable/PID/parent/start identity and unchanged DATA, only
that old process was terminated; replacement then completed. This maintenance
shutdown route is not claimed as a verified preventive application shutdown fix.
The wording above records this evidence-based deployment choice, not a change
to requested clipboard behavior. Private logs/stack and the old release remain
available for diagnosis/rollback.

Final reconciliation: W1-W4 verified by the unchanged implementation tests and
native read-only checks; W5 verified at the published/downloaded/installed and
production-control boundaries above. Exact task scratch was removed through
transactional cleanup (21 members, 126,944,576 bytes); no residuals or errors.
Maintained release artifacts, diagnostics, rollback and active runtime scratch
were preserved. All implementation and delivery stages are COMPLETE.
