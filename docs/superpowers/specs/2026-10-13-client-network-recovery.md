# Client Network Recovery

Authorization: implementation, publication of matching Android/Windows release,
and local Windows update are authorized. Android installation remains user-owned.

## Requirements

- R1: Windows retries failed DNS/TCP/STOMP reconnects until recovery or explicit
  disconnect, with one connection owner and no stale callbacks mutating new state.
  Connected means STOMP CONNECTED, not merely an open WebSocket. Missed negotiated
  heartbeats close the failed transport. Preserve authentication and encryption.
- R2: Windows default HTTPS trust must survive removal of PyInstaller's extracted
  certifi file. Keep certificate and hostname validation and custom CA support.
- R3: Android STOMP heartbeat/connection failure must discard an unresponsive
  socket and continue reconnecting, without relying on its native close callback.
  Keep strict Shizuku and inbound sync behavior. Record health-operation diagnostics
  to identify any distinct foreground-loop stall; do not claim the historical stall
  root cause is proven from the post-restart logs alone.
- R4: Verify failure/recovery and clipboard transport with focused regression and
  real protocol checks. Do not disrupt global DNS/Tailscale to simulate failure.
- R5: Align Android/Windows version and artifact identity, retain Android signer,
  update release notes, commit/push, publish and independently download/verify both
  assets. Replace Windows locally preserving DATA and verify running version.
- R6: Every-six-hour audit is active, quiet when healthy, with scoped maintenance
  and fixes/releases authorized; never auto-install Android updates.
- R7 (authorized during delivery): Both activity views offer explicit Resend for
  retained text entries, separate from local Copy. Reuse the authenticated,
  encrypted P2S/P2P send path and size limits; bypass duplicate/echo rejection only
  for this intentional action, never queue offline sends. Disable while the
  transport is unavailable, report local handoff rather than remote delivery ACK,
  and preserve the bounded memory-only history. Test repeated explicit resends,
  disconnected/evicted entries and unchanged ordinary duplicate protection.

## Stages

1. Windows recovery - COMPLETE. R1/R2: failure-first tests and real local STOMP
   failure/reconnect checks; stable validated TLS trust.
2. Android recovery - COMPLETE. R3/R4: actual stompjs heartbeat and DNS-like
   connection failure regression; foreground phase diagnostics and focused tests.
3. Resend and delivery - COMPLETE. R4/R5/R6/R7: explicit history resend is
   integrated and verified, matching signed builds are published and independently
   downloaded/verified, and local Windows replacement/live sync is verified.
   The initial 3.2.0.27 local candidate preceded R7; the final published 3.2.0.28
   identifies the integrated recovery/resend build.

No blockers or tracked deferrals. The initial Android logs show a missed health
probe at 04:18:22 followed by automatic restart and STOMP recovery. Windows logs
show reconnect timeouts, prolonged Detected-only activity, and a missing
`_MEI77802/certifi/cacert.pem`. Those are observations, not proof of one shared cause.

Audit automation `audit-clipcascade-recovery` was created ACTIVE every six hours.

Stage 1 evidence: focused Windows recovery/auth/enrollment tests pass. A real
Node ws server verifies two DNS failures before initial handshake, a subsequent
established socket drop plus two further DNS failures, and successful SEND after
each recovery. Only one reconnect worker is used. HTTPS `/health` returns 200
with Requests' default certifi path deliberately missing; OS SSL context retains
CERT_REQUIRED and hostname checking, and missing custom CA files remain errors.

Stage 2 evidence: real installed stompjs tests reproduce both original defects
with discard disabled: missed heartbeat leaves connected=true, and silent native
handshake closure prevents another attempt. Enabling discard passes both tests,
including reconnect, send and late old-socket closure. Integrated service,
shutdown, lifecycle and health tests pass; ESLint has no errors (existing warnings).
Native watchdog now reports the last JS health phase and elapsed time, without
clipboard data or secrets. This diagnoses distinct future foreground-loop stalls;
the historical stall's exact awaited operation is not retrospectively proven.

R7 verification: Windows selected-row UI invokes Resend with retained full text,
leaves local Copy separate and disables Resend offline. P2S and P2P regression
checks bypass duplicates only for explicit sends. Android service integration
accepts repeated resends, rejects offline and oversized sends, and preserves
ordinary duplicate suppression; stale service cleanup cannot detach the new sender.
Windows and Android regression suites pass; the focused Android integration check
also passes after adding size-limit and ordinary-duplicate assertions.

Local Windows 3.2.0.28 is connected to production using cached API authentication.
Its DATA SHA-256 is unchanged through replacement and startup. A real clipboard
copy logs Local Text Detected followed by Sent. Android has not been updated.
The 3.2.0.27 native release tests/build passed through the shared gate on Java 21,
with two workers, parallel=false, 3 GiB heap, Kotlin in-process, one 512 MiB test
fork, build/helper exit 0 and post-build daemon exit verified. Final 3.2.0.28
Android packaging also passed through the gate with the same worker/JVM profile
and verified daemon exit. Its APK reports versionName 3.2.0.28, versionCode
3020028, label ClipCascade and the unchanged signing certificate SHA-256
fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c.
The Windows immediate-handshake-close race has a failure-first regression check;
serialized connection-state publication now rejects that closed transport.

## Final Delivery Evidence

- Release: https://github.com/Darkaxt/ClipCascade/releases/tag/3.2.0.28
  (public, non-draft, non-prerelease). Release tag and implementation commit:
  b90e1e72d5c7a3de8012af7d24670241fbeefdae, pushed to origin.
- Independently downloaded both release assets and SHA256SUMS using GitHub CLI.
  Both computed digests match the checksum file and verified local deliverables:
  Android EBEA7D533D8FD6A1B57A8880ABF7BD369FE318BEB8445966CE52A593924F9C72;
  Windows 46B5276F59514C7C2712732918612A14A798C5134E21384DEA20ECFEF3A3A26C.
- Downloaded APK passes apksigner verification with the unchanged certificate
  above, versionName 3.2.0.28 and versionCode 3020028. Downloaded Windows PE
  FileVersion and ProductVersion both report 3.2.0.28. The installed EXE has the
  same published digest. Its parent/child processes are running from the intended
  installation directory; cached API authentication and real clipboard send were
  verified after final replacement. No Android installation was performed.
- Audit configuration read back: audit-clipcascade-recovery is ACTIVE, every six
  hours, quiet when healthy, with Android installation explicitly prohibited.
- Reviewed cleanup transactions 852f3f5ac06422d34e568f2172568b50 and
  addbcc354d72cc7010087d9d307cdd65 are applied with no residual errors, reclaiming
  427211838 and 57928765 bytes respectively. Final deliverables and private
  verification evidence remain under private/releases/3.2.0.28.

All R1-R7 acceptance criteria are satisfied at the stated verification level.
No blockers or tracked deferrals remain. Android transport recovery is verified
against the real protocol implementation and signed packaging, not a new device
installation; historical unrelated foreground-loop stalls remain diagnosable,
not claimed retrospectively resolved. Existing GitHub dependency alerts are
outside this recovery/resend scope.
