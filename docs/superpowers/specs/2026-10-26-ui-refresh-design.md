# Android And Windows UI Refresh

Authorization: already_authorized. Redesign both applications using Huashu, with
LLM Coordinator and TailD as user-provided references. This is a new task after
the verified 3.2.0.33 protocol release; do not modify its transport behavior.

## Product Contract

- U1: History is the primary workspace. Retain text Copy and Resend, event detail,
  search/filtering in the proposed interface, clear history confirmation, and
  honest Sent/Delivered/Applied/error distinctions. Prototype data is fictional
  and harmless, never taken from banking/private clipboard logs.
- U2: Separate capture health, service state, connection state and delivery state.
  Client Alive is not a clipboard application ACK. Do not invent per-device
  delivery detail or historical data absent from the current protocol.
- U3: Preserve current sign-in/enrollment, encryption, keys, settings, supported
  backends, autostart/recovery, notification grace periods and tray/window icons.
  Keep routine monitoring quiet. Hide advanced options behind deliberate access,
  not behind missing controls. Closing a window must not exit the service.
- U4: Native-feeling Android and Windows layouts from a coherent visual system,
  not a marketing dashboard. Existing React Native/Python UI boundaries are the
  implementation baseline; do not choose a framework migration from appearance
  alone. Keep all existing settings accessible.
  User clarification (2026-10-26): theme the Windows non-client title bar and
  resize border as well as the contents, across activity, login and app dialogs.
  Preserve native window controls and tray behavior; verify native DWM read-back
  and screenshot evidence, including reopening a window.
- U5: Use Huashu to explore six thumbnail candidates and present three distinct,
  usable HTML design directions for selection. All use identical sample content,
  existing ClipCascade artwork, real reference evidence and library icons.
- U6: Validate selected-row actions, navigation, settings, error/pending states,
  readable contrast and overflow at 1600x1100, 1280x900 and 390x844. Android touch
  controls are at least 44px. Body text 14px desktop / 16px mobile, labels 12px.
  Stable rows and toolbars; no negative letter spacing, viewport-sized text,
  decorative hero, nested cards or decorative charts.
- U7: After selecting the visual direction, implement and test both native apps,
  publish matching versioned packages through the existing channel, independently
  verify them and update local Windows. Android installation stays user-managed.

## Stages

1. Design direction: COMPLETE (U1-U6). Six candidates and three interactive
   Android/Windows directions rendered with sample-only data. The user selected A
   in direction-approved.md. The saved verify-prototypes.mjs completed through
   owned Helium on all three directions at 1600x1100, 1280x900 and 390x844, including
   selection, search, filters, Copy/Resend, health, settings, clear cancellation and
   text-only replay. No page errors or overflow; mobile controls meet 44px.
   Screenshots are in the design deliverable. Earlier pending actions were traced
   to switch hit areas, an incorrectly scoped test locator and min-content grid
   overflow, all corrected and reverified; they were not external blockers.
2. Native implementation: COMPLETE (U1-U4,U6). Depends on the selected design.
   Preserve runtime boundaries, implement both UIs and validate real workflows.
   Native frame regression reproduced and fixed using DWM attributes on mapping.
   Native Windows read-back verifies dark mode on root and child windows after
   reopening; all four DWM setters succeed. Caption/border color attributes are
   set-only, so their acceptance uses API success plus inspected native screenshots.
   Android release/debug builds and release JVM tests passed through the shared
   gate (ticket 1786); actual max workers 2, parallel false, Java 21 / Gradle 9.1.0,
   Gradle heap 3GiB, one test fork. Build and helper exit 0, daemon exit verified.
   Final insets build passed through ticket 1788 with the same verified profile
   and daemon exit. One intervening request refused an already-used log path
   before launching Gradle; unique log names resolved that guard without deletion.
   Native Windows activity/health/settings/login/error screens inspected, including
   800x520 history with visible Copy/Resend and scrollable secondary views.
   Actual Tk button checks confirm selected-text Resend, offline disabling and
   close preserving the tray root. Native Android API35 emulator at 390x844dp
   inspected for history, health, settings and login with system-bar-safe controls.
   Only a dedicated sample-data emulator was installed; user phones untouched.
   Existing desktop/mobile suites passed; affected UI/app/frame/version checks
   passed again after their relevant changes. Transport/recovery source unchanged.
   Both packages verify as 3.2.0.34; Android versionCode3020034 and existing signer
   preserved. Windows packaged GUI/source and control artwork match current files.
   APK DEX inspection confirms the release preview hook returns only an empty
   string. U1-U4/U6 reconciliation has no remaining blockers or deferrals.
3. Final release and activation: COMPLETE (U7). Published normal release
   3.2.0.34 from source/tag commit 88329da6e672f749d443a9b9c84051e9c4b28d18;
   remote tag peeled back to that commit and client-version CI passed.
   Both client assets and SHA256SUMS read back as uploaded, not draft/prerelease.
   Independently downloaded packages passed hash, embedded version, APK signer,
   disabled preview DEX and Windows GUI/source/artwork checks. No stale server
   JAR was uploaded; server 3.2.0.33 is unchanged.
   Local Windows installed from the verified download; executable source/artwork
   verified again after installation. DATA hash unchanged. Exact parent/child
   process pair verified, with Python DLL loaded from persistent D: runtime.
   Fresh session-bound Client Alive acknowledged Windows 3.2.0.34 at
   2026-10-26T21:15:19.029453276Z (probe d56b20ef-94a7-4e20-b416-1096f8813d37).
   This proves control connectivity, not clipboard application delivery. Android
   installation remains user-managed; no user phone was installed or restarted.

No tracked deferrals. Design direction A is selected; implementation/publication
remain authorized without another approval checkpoint.

## Design Deliverables

`design-demos/2026-10-26-ui-refresh/`: index, six-candidate board, three interactive
directions, source CSS/JavaScript, reference/brand notes and verified screenshots.
Sample status labels are illustrative, not measurements of connected devices.
