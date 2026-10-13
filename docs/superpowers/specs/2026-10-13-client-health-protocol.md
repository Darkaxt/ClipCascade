# Silent Client Health Protocol

Authorization: implement the requested server-first visibility/probe workflow.
Existing project delivery authority covers verified GitHub synchronization,
matching client release publication and local Windows update. Server activation
is required for live integration. Android installation remains user-owned.

## Requirements

- H1: In deployed P2S mode, management API keys can list their own user's active
  authenticated connections with server-derived device identity, client-reported
  platform/version, capability and latest probe/ACK timestamps. Sync-only keys
  cannot enumerate or probe other clients. Never expose secrets or clipboard data.
- H2: A separate versioned control destination carries silent probes and ACKs.
  Correlate an unpredictable probe ID with the exact authenticated session and
  user. Wrong-session, stale and duplicate ACKs cannot change health state.
  Keep at most one outstanding probe and one result per active session. Repeated
  requests reuse an outstanding probe. Disconnect discards connection state;
  reconnect must advertise capability again. No timeout-driven restart/fallback.
- H3: Android foreground service and Windows STOMP handler subscribe/advertise
  after every connect and ACK valid probes on the same transport. Never invoke
  clipboard capture/apply, encryption payload processing, activity history,
  notification or user interface for control traffic. Malformed/unknown protocol
  messages are ignored. Normal clipboard encryption/fanout stays unchanged.
- H4: Older clients are explicitly unsupported, not failed. No ACK is pending,
  not proof of a dead device. P2P mode is explicitly unsupported in this version.
  ACK proves application control handler liveness, not end-to-end clipboard
  capture, apply or delivery. No clipboard delivery ACK is introduced here.
- H7 (user clarification): Define two typed ACKs: `client_alive` responds to a
  probe and `clipboard_detected` reports a local watcher observation. Retain only
  the latest server receipt timestamp and clipboard type per active session,
  including observations subsequently suppressed by normal duplicate handling.
  Never transmit preview, text, filenames, hashes or binary data for diagnostics.
  This is capture evidence, not proof of delivery or application. Offline events
  are not queued and control send errors cannot interrupt clipboard processing.
- H5: Verify the integrated protocol, user isolation, nonce/session matching,
  reconnection, backward compatibility and silent handling with focused checks
  and a real authenticated server/client exchange. Build matching signed clients,
  publish/download-verify, preserve Windows DATA and Android signer.
- H6: Update the existing six-hour audit to use server visibility/probes first;
  reserve ADB for evidenced Android faults or explicitly requested diagnosis.
  Remain quiet when healthy, distinguish unsupported/pending/offline, and never
  auto-install Android or mutate clipboard to run an audit.

## Stages And Reconciliation

1. Integrated protocol - COMPLETE. H1-H4/H7: server and both P2S clients wired.
   Real Spring server/WebSocket integration verifies authenticated hello, private
   probe/alive ACK, capture ACK, management-only REST and disconnect cleanup.
   Session/user mismatch and duplicate ACK checks pass. Windows transport/recovery
   and Android foreground integration checks pass, with separate control/clipboard
   destinations and no probe activity-log entries. ESLint has no errors.
2. Delivery and audit - COMPLETE. H5-H6: matching signed client builds and server
   JAR published, downloaded independently and verified. Server/local Windows
   activated; production Client Alive ACK verified. Audit updated, read back and
   exercised with the dedicated management key. Reviewed cleanup is applied.

Delivery checkpoint: server JAR and Windows EXE are built at 3.2.0.29. The
production server reports 3.2.0.29 and retains localhost-only port 18080 and the
existing Docker/Tailscale network. Windows is replaced and connected; DATA digest
is unchanged. Original server image retained as local/clipcascade:pre-health-20261013
for rollback (retag it as local/clipcascade:3.2.0 and recreate only clipcascade;
restore its packaged /app/app.jar before a later build). No data/config changes.
The Android build completed through shared gate ticket 970 on Java 21, two
workers, parallel=false, 3 GiB heap and Kotlin in-process. Build/helper exit 0,
profile verified and post-build daemon exit verified. Assemble-only invocation
has no test-fork marker; native code is unchanged. APK versionName 3.2.0.29,
versionCode 3020029, label ClipCascade and retained signer SHA-256
fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c.

Resolved H5/H6 credential blocker: user explicitly authorized creating the key.
Provisioned one dedicated manage_keys record through exclusive local H2 access,
with graceful container stop and restart. No account credentials or existing key
scopes/secrets were changed. Its plaintext is only in the external key file, ACL restricted
to the user and SYSTEM. Production device key still receives 403 on audit API.
Live server probe receives Client Alive from installed Windows 3.2.0.29; a
connected Android 3.2.0.28 client is accurately unsupported, not unhealthy.
The six-hour audit configuration is updated and read back, using server probes
first and ADB only for targeted diagnosis. No clipboard mutation for live probes.

## Final Delivery Evidence

- Public release: https://github.com/Darkaxt/ClipCascade/releases/tag/3.2.0.29
  (non-draft, non-prerelease). Source/tag commit:
  4a21e3470a44d2fd2cf8a8da1efa18347a34cbc3, verified on origin.
- Independently downloaded APK, EXE, JAR and SHA256SUMS. Computed digests match
  the checksum file, private deliverables and installed Windows binary:
  APK 0BD0F0D942C463F0414B19C739AF09C971F6178FD7E79B367E89D58ECE6BE097;
  EXE 88243EE68F4F5651C7FF081D8BB11AD334764155BE4756F83122D2DA6C7D5B1A;
  JAR 1ACC5C96D1CF215F252ACDE278656D4626E0372D76C3A171844D2AAE150E9F3A.
  Downloaded APK signature verifies with the unchanged certificate above; Windows
  FileVersion and ProductVersion both report 3.2.0.29. Production server version
  endpoint reports 3.2.0.29. Private verification records remain under
  private/releases/3.2.0.29/verification.
- Production probes acknowledged by Windows 3.2.0.29 at 14:03:47Z and 14:06:34Z.
  Its original installed parent/child processes exited gracefully, and DATA
  digest remained ACA3A1A91300692AB38FA815FCEA9080EBA3A78A87F8613EC703677C1B57E3CE.
  The connected legacy Android phone is listed unsupported with its registered
  identity. No ADB commands or Android installation were used for this delivery.
- Clipboard Detected is verified through Android foreground capture integration,
  Windows control handler checks and real server typed-ACK integration. Live
  probe verification intentionally did not mutate the clipboard or fabricate a
  capture report. The latest production session had no new capture observation
  at the final read; an idle capture timestamp is not a fault.
- Existing audit automation remains ACTIVE every six hours. Its server-first
  helper completes successfully with the restricted external management key;
  device sync key access is refused with HTTP 403. The helper never follows
  redirects with credentials and filters output to the documented metadata.
- Cleanup transactions 2e86c66d710dc45cabc09363cf4e48b6,
  2f23bd7acb9bdc6c91cd97054057e82a and b49bfb4c6ae6e40768555f17a5013093
  are applied without errors, reclaiming 329753184, 80785489 and 11154 bytes.
  Persistent releases, private evidence, signing identity, audit key and defined
  server rollback image are retained.

H1-H7 are satisfied at the stated verification level. No advancement blockers
or tracked deferrals remain. Android device-side ACK verification awaits the
user-owned update, not an agent-installed APK. This release does not implement
clipboard delivery/apply ACKs or P2P health, or claim to resolve unrelated security
alerts or every possible client lifecycle failure.

No tracked deferrals. Android live ACK verification depends on the user installing
the published update; legacy installed clients must remain accurately unsupported.

## Wire Contract

- Client subscribes to `/user/queue/client-health`, then sends to
  `/app/client-health`: `{protocol:1, kind:"hello", platform:"windows"|"android",
  version:"..."}`.
- Management GET `/api/client-health` returns mode and own-user connection rows.
- Management POST `/api/client-health/probes` sends a probe to each supported
  own-user session, reusing any pending one, and returns current connection rows.
- Probe: `{protocol:1, kind:"probe", probeId:"random UUID"}`.
- Alive ACK: `{protocol:1, kind:"ack", ackType:"client_alive",
  probeId:"same UUID"}` to `/app/client-health`.
- Capture ACK: `{protocol:1, kind:"ack", ackType:"clipboard_detected",
  clipboardType:"text"|"image"|"files"}` to `/app/client-health`.
- GET is the poll/read boundary, not a request to wait or restart anything.
  State is `unsupported`, `ready`, `pending` or `acknowledged`, with independent
  server connection visibility and timestamps. Offline registered API clients
  have no active connection row; key inventory remains the existing key API.
