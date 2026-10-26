# Clipboard Application Acknowledgements

Authorization: already_authorized. User requested improvements and explicitly
requires receiving-client acknowledgement after successful clipboard application
before treating a repeated outbound payload as delivered. This supersedes the
timestamp-only Android repair. No UI redesign is needed for this bug-fix branch.

## Requirements

- A1: A new Android copy action is observed even when its text equals the previous
  copy. Use ClipDescription timestamp plus content identity; unchanged polling
  samples must not become artificial new copy actions. Startup seeds observation
  state without broadcasting an old clipboard. Null/clear transitions are tracked.
- A2: P2S clipboard messages carry unique IDs. Server records only bounded delivery
  metadata, never plaintext/encryption keys, binds origin and acknowledgers to
  authenticated user/session identities, and keeps existing sender exclusion.
  Recipients are the other sessions actually targeted by this fanout; a newly
  connected/offline client is not retroactively an acknowledged recipient. Zero
  recipients, legacy recipients and missing acknowledgements mean unconfirmed.
- A3: Windows and Android acknowledge a message only after successful application.
  Failures, decode/decrypt/size rejection and queued file downloads do not ACK.
  Repeated transmission of an already applied message can be re-ACKed without
  reapplying. ACK state remains distinct from Client Alive/Clipboard Detected.
- A4: A socket send is Sent/unconfirmed, not delivery. Only confirmed per-message
  recipient completion permits the existing short-window outbound duplicate
  suppression. An unconfirmed payload remains eligible on fresh copy/manual
  resend, including reconnect. Local post-apply echo suppression stays separate.
  P2P/legacy peers without application ACK support remain unconfirmed and must
  not acquire delivered-payload suppression. No timer-driven resend loop or
  arbitrary delivery-expiration success; bounded-state eviction is unconfirmed.
- A5: Preserve encryption, keys, credentials, data, existing capture backends,
  notification grace periods and tray/window icons. Do not change Secure Folder
  permissions or install/restart Android for diagnosis. Tests/logs must not expose
  banking content. User will install the new Android release themselves.
- A6: Release matching versioned updated artifacts through existing GitHub channel,
  independently retrieve/version/hash/signer check them, update local Windows and
  required production server through their existing procedures, preserve rollback,
  and verify production control/ACK integration without claiming old Android
  installations exercise the new protocol. Document live-device verification limits.

## Stages And Reconciliation

1. Integrated observation and delivery protocol: COMPLETE (A1-A5).
   Acceptance: native fresh-copy regression, authenticated fanout/ACK integration,
   receiver successful-apply/failure tests and sender suppression tests for both
   clients. Verify legacy/unsupported stays unconfirmed and no sender echo.
   Verified: desktop suite passes; Android Jest suite passes; release Kotlin
   tests and APK assembly pass. Real authenticated Spring/WebSocket integration
   verifies both recipients must ACK, origin ACK is rejected and no sender echo.
   Focused server tests verify cross-user/unknown-recipient rejection, zero-peer
   unconfirmed state, ID/content binding and server-only private delivery state.
   Receiver failure/retry/re-ACK and outbound confirmed-only suppression pass in
   both client tests. Android text application now awaits a native Promise; queued
   file downloads remain Available, never application-ACKed.
   No blockers or tracked deferrals remain in this stage. Scope assessment: native
   observation and per-transport delivery are distinct bounded state owners, not
   competing duplicate filters; no material refactoring debt needs another stage.
2. Final release and activation: COMPLETE (A6).
   Acceptance: completed stage 1, release packages from verified source, public
   download read-back, unchanged signing/data and verified local/server activation.
   Package verification passes: APK 3020033/3.2.0.33 with unchanged signer,
   Windows PE 3.2.0.33 with seven packaged modules matching verified source and
   unchanged icons, and server JAR compiled version 3.2.0.33. All three hashes
   are recorded in the release SHA256SUMS.
   Published normal GitHub release 3.2.0.33, source/tag
   b4aeeae28b4d14d87e11582ce6268283bfca3aad. Version-consistency CI passed.
   Independently downloaded all assets and verified hashes, PE/package versions,
   Windows packaged code/icons, Android signature and compiled JAR version.
   Production API independently reports server 3.2.0.33. Running JAR matches the
   downloaded release hash; the existing JRE base, environment values and
   database/log binds are preserved. First activation rolled back because a
   deployment assertion compared environment list order; structured key/value
   comparison verifies the successful activation. Original image/compose remain
   available for rollback; future compose builds use the versioned build context.
   Local Windows installed EXE matches the downloaded package and reports
   3.2.0.33 through a fresh session-bound Client Alive ACK. DATA hash is unchanged
   before/after replacement and startup; matching 3.2.0.32 rollback is retained.
   Both legacy Android clients reconnected automatically and acknowledged fresh
   control probes after the restart. No phone installation/restart, clipboard
   test injection, credential/encryption-key change or DNS/Tailscale change.
   Application-ACK behavior is verified by real authenticated WebSocket
   integration and client apply/failure tests, not by the control ACKs. Physical
   Android 3.2.0.33 application-ACK testing remains explicitly outside this
   activation claim because installation is user-managed; old 3.2.0.31 clients
   remain unconfirmed recipients. Release availability is verified, not device
   acceptance of a version that has not been installed.
   Reviewed exact task scratch was cleaned (330,509,705 bytes), preserving release
   packages, diagnostics, rollback and the installed client's persistent scratch.
   No unresolved release blocker or tracked deferral. Final reconciliation A1-A6
   is satisfied at the stated verification boundaries; no new design debt found.

## Delivered Package SHA-256

- Android: d88c86db6dc80593ec4e6b2f04265a7a1b096eccc1975d81508c23a2f2678557
- Windows: 42f85f702e38b7d4bb27afb590a8dd9a00ccb4addf104104de93cf46181e7577
- Server: e6391386d2e1d60bfab4299d05a8c7e8ffe8c4d36fdfa32fa642f4ef1f9878c7

Android used Gradle 9.1.0 and Java 21 through the shared build gate, with observed
two Gradle workers, parallel disabled, 3 GiB Gradle heap and one 512 MiB test fork.
Kotlin 3 GiB was requested, not independently observed as a separate JVM heap.
Build/helper exits were zero and post-build daemon exit was verified. No memory
increase or lifecycle exception was needed. These are not a host-wide memory or
Metro/native-concurrency guarantee.

## Investigation Evidence

Samsung RFCY80551LT runs Android SDK 37 and ClipCascade 3.2.0.31 in user 0.
Revolut runs in Secure Folder user 150. Both service and Shizuku poll thread were
alive; no service restart or permission change was performed by this investigation.
Benign text reached Windows at 20:44:54 local and the later bank copy at 20:48:27
local was received/applied without a service restart. Profile isolation was a
hypothesis, not an established permanent block. Independently, native watcher
source compares only type/content forever, while JS limits duplicates to five
seconds. Current transport has no per-payload application ACK. These are concrete
gaps addressed by this specification, not a claim that a specific policy change
or single historical root cause has been proved.
