# Windows Connection Notification Grace Period

Authorization: user requested implementation and a locally updated Windows client.
Existing project delivery authorization includes verified GitHub synchronization.

## Requirements

- N1: Keep automatic reconnection immediate and unchanged. Notification timing
  must never block transport work.
- N2: An unexpected outage must remain continuous for 60 seconds before a lost
  notification. Repeated failed attempts must not reset that grace period.
- N3: Recovery before that warning is silent. After a warned outage, report
  recovery only after 60 seconds continuously connected. Flapping cancels the
  pending recovery and must not repeat the outage warning.
- N4: Explicit disconnect/logout/shutdown cancels pending notifications; stale
  callbacks cannot notify. Initial login is not a recovery notification.
- N5: Apply the same notification policy to P2S and P2P on Windows, preserving
  existing notification preferences and other platforms' immediate policy.
- N6: Verify timing with controlled timer callbacks, transport integration,
  packaged binary and production Client Alive ACK. Preserve DATA and do not
  disrupt Tailscale or write test clipboard content.

## Stages

1. Notification policy and transport integration: COMPLETE (N1-N5).
   Controlled timer tests cover short outages, repeated failures, stale callbacks,
   recovery flapping, explicit reset and non-Windows immediate behavior. P2S and
   P2P callback integration passes; real local WebSocket DNS/drop recovery passes.
2. Package, local update and delivery verification: COMPLETE (N6).
   Built PE version 3.2.0.30, gracefully exited the previous installed process
   identities, replaced the EXE and restarted hidden from its install directory.
   DATA digest remained unchanged. Production session
   784bdc42-ffd0-811b-716c-35d6be1bca8e acknowledged a fresh Client Alive probe at
   2026-10-16T11:54:57.604571802Z. This verifies control-channel connectivity,
   not remote clipboard application. No test clipboard content was written.

## Final Reconciliation

N1-N5: verified with controlled timers, both transport callback integrations,
real local WebSocket DNS/drop recovery and saved-authentication checks. Pending
timers are daemon-owned, cancelled by explicit shutdown and token-guarded against
stale callbacks. No reconnect cadence was changed.

N6: release 3.2.0.30 points to source commit
2f6affaa312f8a4e5b0ae960940e5172c67e3344. The downloaded EXE is 57935020 bytes,
PE FileVersion/ProductVersion 3.2.0.30, SHA-256
4FC2E6511D7E6098033936CFD71570EAD2DDD0F47E353A1EAB99C347FA0F1D46,
matching built and installed bytes and downloaded SHA256SUMS. GitHub Client
version consistency passed. Private build, test and delivery evidence is retained
under private/releases/3.2.0.30/verification. Timing was verified deterministically,
not by disrupting production Tailscale or capturing actual Windows toasts.

Cleanup transaction c8328aaf2c2f97f876811940e58d1bf0 applied without errors,
reclaiming 126899801 bytes of exact reviewed task scratch. Requested artifacts,
rollback release, credentials and evidence remain intact.

All requirements satisfied at the stated verification level. No blockers or
tracked deferrals remain.

Windows-only version is 3.2.0.30. Android/server remain 3.2.0.29; do not publish
older Android/server artifacts under the Windows release. Metadata verification
checks each platform against its own declared version.

No tracked deferrals. Acceptance evidence will be recorded here.
