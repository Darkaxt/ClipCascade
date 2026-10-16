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
2. Package, local update and delivery verification: ACTIVE (N6).

Windows-only version is 3.2.0.30. Android/server remain 3.2.0.29; do not publish
older Android/server artifacts under the Windows release. Metadata verification
checks each platform against its own declared version.

No tracked deferrals. Acceptance evidence will be recorded here.
