# Clipboard retry identity and Windows access recovery

Authorization: already authorized bug investigation/remediation, including normal
final release and local Windows activation; Android installation is user-managed.

## Evidence and Scope

User screenshot shows repeated remote receives approximately every 750 ms with
Windows clipboard-acquisition failures. Regression introduced in application-ACK
change b4aeeae: repeated unconfirmed sends allocate new IDs, so successful receivers
cannot recognize a retransmission. Android echo protection also expires by time,
not clipboard provenance. Historical phone logs were lost on reboot; the exact
initial trigger remains unproved. Current phone DNS failures are separate.

## Acceptance

- R1: Repeating the latest unconfirmed clipboard send reuses its delivery ID and
  exact serialized encrypted body. Failed recipients may retry; successful ones
  re-ACK without another native clipboard write. Different content, connection
  reset, and explicit Resend start new deliveries. No password/key changes.
- R2: Native Android writes made for remote application are marked with a
  process-local origin token. Both native capture backends ignore those writes
  independently of JS timing. A new copy of identical text by another app remains
  observable. Text and image remote apply paths, including P2P, are integrated.
- R3: Windows transient busy acquisition retains only the latest pending remote
  application and retries outside the WebSocket callback. Newer remote data,
  clipboard changes and disconnect supersede/cancel stale pending work. No ACK
  until successful application; no repeated error rows for each acquisition poll.
  Acquisition polling is confined to the native API, which exposes no close event;
  no arbitrary deadline controls pending delivery lifetime.
- R4: Windows logging is installed even if an imported library configured the root
  logger; diagnostic retention is bounded and existing logs are not truncated.
  Do not log clipboard contents or credentials. Existing UI/icons remain unchanged.
- R5: Regression tests cover forty unconfirmed sends with a successful and a
  failed receiver, encrypted body identity, explicit resend, delayed owned native
  events and a genuine same-text copy; Windows contention recovery/cancellation
  and ACK order receive focused tests. No live clipboard test values without an
  explicitly scoped test, no service restart before collecting evidence.
- R6: Publish matching versioned Android/Windows client assets, verify delivered
  hashes/versions/signature and packaged fixes; activate Windows preserving DATA
  and verify fresh control ACK. Do not install Android or alter DNS/Tailscale.

## Stages and Reconciliation

1. Integrated retry-loop and access recovery fixes: COMPLETE (R1-R5).
   Forty-send regression failed on old code (forty native writes), passes with
   stable retry identity (one write on successful receiver). Ciphertext identity,
   explicit Resend, reset/concurrent preparation and application-ACK ordering pass.
   Windows busy acquisition recovers outside transport, duplicate pending work is
   coalesced, disconnect and changed local sequence cancel without ACK. Root-logger
   replacement and bounded persistent logging pass. Desktop suite passed; focused
   affected tests rechecked after the final sequence comparison change.
   Mobile suite passed all but one pre-existing UI test's 5-second cold-run
   deadline; that unchanged UI file then passed independently without increasing
   its timeout. Updated delivery tests also pass. Android release unit tests,
   native origin/observation contracts and signed assembly passed through ticket
   1812 (45e5440c1dec42ac8f010c651c38bc1d): build/helper exits zero, daemon exit
   verified, observed workers 2, parallel false, Gradle 3 GiB, test fork 1/512 MiB.
   Kotlin 3 GiB requested, not independently observed as a separate JVM budget.
   Native Win32 read-only acquisition/real contention recovery verified with no
   clipboard reads/writes. A private-window-station content-write test was denied
   by Windows before any writes; no native content-write claim is made.
   Refactoring assessment: bounded delivery state and one pending acquisition are
   distinct required owners, not a generalized retry framework. No tracked debt,
   unresolved acceptance blocker or deferral. Phone installation remains outside
   this verification boundary; no claim to have recovered lost historical logs.
2. Final release and local delivery: COMPLETE (R6).
   Normal published release/tag 3.2.0.35 points to source commit
   90d2c2e2bc007a2d7c4db471bf21479ce5897d35. Version-consistency CI 41050527907
   passed. Remote main/tag and publication state/assets were read back. Both
   downloads were independently retrieved and checked against build SHA256SUMS,
   embedded versions, APK signer and native provenance paths/JS retry guard.
   Windows packaged code matches all sixteen checked modules; artwork is unchanged.
   Local Windows exited through its original native tray loop, without forced
   termination or logoff. Installed EXE matches the downloaded release. DATA hash
   remained byte-for-byte unchanged through replacement and startup. Persistent
   runtime is D:\AppScratch\ClipCascade (loaded python311.dll path verified),
   not expendable task scratch. A fresh session-bound Client Alive ACK reports
   Windows 3.2.0.35; this does not substitute for application-ACK regression tests.
   Existing 3.2.0.34 package is retained as the explicit rollback source.
   Android was not installed/restarted; update availability is verified, not
   physical-device acceptance of an uninstalled APK. No DNS/Tailscale changes.
   D: build scratch cleanup bd211704eb1870d12b5f4c9c4f8f47f5 applied successfully:
   111145512 logical bytes, no exclusions/errors. Independent-download/helper
   cleanup 14ad42cb3b0349806c931a7568d9e992 also applied: 153038973 logical bytes,
   no exclusions/errors. Required packages, verification and active runtime remain.
   Final reconciliation: R1-R6 verified at the declared boundaries, no release
   blockers or tracked deferrals; stage-1 debt assessment remains applicable.

## Delivered SHA-256

- Android: 06c498fd8ed34cc1189e149cbd1f892bac68dc814cbaef44abcc0f079c6814c9
- Windows: de76763f162d277ec7fbce94426367888a85d0b162259dba97913895e6d18e8b

New build scratch is D:\Temp\clipcascade-retry-3.2.0.35 (native/small-file I/O
exception). Required versioned deliverables/verification are retained at
D:\Artifacts\ClipCascade\releases\3.2.0.35. Independent download scratch will be
E:\Temp\clipcascade-download-3.2.0.35. Clean scratch after its last consumer.

The forty-send reproduction establishes a protocol defect, not proof of the lost
incident's first trigger or of which external process blocked Windows clipboard.
