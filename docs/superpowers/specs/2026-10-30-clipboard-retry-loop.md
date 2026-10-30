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
2. Final release and local delivery: ACTIVE (R6).
   Remaining: Windows packaging, independent package checks, commit/publication,
   independent download and local activation/ACK. No tracked deferrals.

New build scratch is D:\Temp\clipcascade-retry-3.2.0.35 (native/small-file I/O
exception). Required versioned deliverables/verification are retained at
D:\Artifacts\ClipCascade\releases\3.2.0.35. Independent download scratch will be
E:\Temp\clipcascade-download-3.2.0.35. Clean scratch after its last consumer.

The forty-send reproduction establishes a protocol defect, not proof of the lost
incident's first trigger or of which external process blocked Windows clipboard.
