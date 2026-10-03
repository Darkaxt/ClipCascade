# Android monitoring recovery

Authorization: already_authorized by the user's request to fix Android ClipCascade.

## Requirements

- R1: Retiring a STOMP connection during service stop/replacement or transport
  recovery must not depend on a server DISCONNECT receipt or native socket-close
  delivery. Use the library's explicit discard operation; no timeout workaround.
- R2: A replacement service starts only after the prior run releases its transport
  and clipboard listeners. Keep one active monitoring run.
- R3: A transport recovery must return control to the health loop and allow future
  watchdog pings and user stop/restart commands.
- R4: Install a version-bumped, signature-compatible build on the connected Samsung
  for live verification, preserving credentials and Shizuku settings. Demonstrate
  watchdog response, restart, and clipboard delivery with the activity backgrounded.
- R5: Commit verified source and document evidence. External publication is outside
  this task. Maintain the repository's synchronized client-version metadata.

## Evidence

Samsung RFCY80551LT, installed 3.2.0.25: the 2026-10-03 08:33 watchdog
restart posts a foreground notification but its post-restart ping remains unanswered.
Later restarts do not log a new foreground callback. ForegroundServiceLifecycle
waits for the previous run to finish. Both STOMP shutdown sites await ordinary
deactivate(), whose library implementation waits for a DISCONNECT receipt when
connected. The supported force option discards callbacks and produces the local
close event immediately. The active TailDNS VPN and Shizuku process are present.

## Stages and acceptance

1. Connection retirement - COMPLETE. R1-R3: reproduce missing disconnect receipt;
   prove connection discard, serialized replacement, and health-ping responsiveness
   with focused regression tests and the actual installed STOMP implementation.
2. Build and device verification - COMPLETE. R4: aligned 3.2.0.26 metadata,
   release build/signature inspection, Samsung install and real background copy,
   restart and watchdog checks.
3. Final reconciliation and commit - COMPLETE. R5: focused checks remain valid,
   document exact device evidence, commit source and retain the requested APK.

Blockers: none. Tracked deferrals: none.

Stage 1 verification: the pre-fix recovery regression stalls at deactivate(); the
fixed path reconnects, answers ping, and accepts stop. Actual STOMP 7.1.1 testing
confirms a graceful deactivate remains pending without a receipt and forced
deactivate releases it without a native close. Service replacement remains
serialized. Focused service/lifecycle/health/shutdown tests pass; ESLint has no
errors (existing warnings only).

## Device verification

- Release assembleRelease succeeded. APK versionName 3.2.0.26, versionCode
  3020026, package com.darkaxt.clipcascade. Certificate SHA-256
  fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c matches
  the prior build. APK SHA-256:
  7C78795E12B62272B9DE9ADECB609CAAB8CF0745DFB8E70CB2DB37FF9B5FCE3C.
- Samsung RFCY80551LT installed with adb install -r. PACKAGE_REPLACED automatically
  started the foreground callback at 09:03:01; saved API-key authentication,
  encryption, and Shizuku settings remained enabled. STOMP connected and the
  pending watchdog ping was answered without a manual Start action.
- UI Restart Service at 09:03:52 logged old-run cleanup followed by a new callback,
  Shizuku listener startup, and STOMP connection at 09:03:53.
- With Android Settings foregrounded, Windows clipboard test
  cc26-background-after-restart pasted correctly into Settings search. A real
  select/copy of cc26-android-background-0905 from that Android field reached
  the existing Windows client. ClipCascade activity subsequently showed the
  inbound Applied and outbound Sent entries. No transport payload was injected.
- Scheduled worker at 09:05:36 received a health reply at attempt 3 (756 ms),
  cleared the inactive warning, and returned success while Settings was foregrounded.
  Earlier manual job probes missed the job's namespace/current id; they are not
  counted as watchdog evidence.
- Android foreground service remained active. This is focused live verification,
  not a multi-day battery/idle endurance claim. The Thor is not connected and
  was not tested. TailDNS/VPN and server configuration were not changed.
- Client metadata consistency tests pass. The latest public release remains
  3.2.0.25; no GitHub release or Windows binary deployment is part of this task.

Final reconciliation: R1-R3 pass the actual-library and focused service tests;
R4 passes the signed installation, automatic start, manual restart, scheduled
health probe, and bidirectional background text workflow; R5 is committed locally
with the verified APK retained. No blockers or required deferrals remain. No
task-owned disposable temporary copies were created; pre-existing build/cache
trees and the retained APK are not cleanup targets.
