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
2. Delivery and audit - ACTIVE. H5-H6: version/sign/build, server/local
   Windows activation and live protocol verification, GitHub release/download
   verification, update audit and cleanup. Stage 1 prerequisite is satisfied.
   Advancement blockers (internal): matching signed builds, live activation,
   release/download verification and audit update not yet complete. Resolve with
   inspected delivery evidence; overall completion depends on those outcomes.

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
with graceful container stop and restart. No existing account/key records were
modified. Its plaintext is only in the external audit key file, ACL restricted
to the user and SYSTEM. Production device key still receives 403 on audit API.
Live server probe receives Client Alive from installed Windows 3.2.0.29; a
connected Android 3.2.0.28 client is accurately unsupported, not unhealthy.
The six-hour audit configuration is updated and read back, using server probes
first and ADB only for targeted diagnosis. No clipboard mutation for live probes.

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
