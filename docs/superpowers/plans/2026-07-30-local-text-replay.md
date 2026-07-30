# Local Text Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore text from recent activity to the current device clipboard without synchronizing it to peers.

**Architecture:** Android and Windows activity stores retain full text only in private, memory-bounded caches keyed by event ID. A one-shot exact-value guard is armed before the OS clipboard write and consumed by the clipboard watcher so replay never enters the outbound send path.

**Tech Stack:** React Native/Jest, Python/Tkinter/unittest, Android Gradle, PyInstaller release pipeline

---

### Task 1: Android Replay Store

**Files:**
- Modify: `ClipCascade_Mobile/src/ClipboardEventLog.js`
- Test: `ClipCascade_Mobile/src/__tests__/ClipboardEventLog.test.js`

- [ ] **Step 1: Write failing store tests**

Add tests proving public events omit raw text, replay lookup returns the full value, clearing removes it, and an 8 MiB total budget evicts the oldest replay payload.

- [ ] **Step 2: Run the focused Jest test and verify RED**

Run: `npm test -- --runInBand src/__tests__/ClipboardEventLog.test.js`

Expected: FAIL because replay lookup and budget exports do not exist.

- [ ] **Step 3: Implement the private cache**

Add module-private replay payload storage, UTF-8 byte accounting, eviction, `getReplayableText(id)`, and a public `replayable` boolean without exposing raw content.

- [ ] **Step 4: Run the focused Jest test and verify GREEN**

Run: `npm test -- --runInBand src/__tests__/ClipboardEventLog.test.js`

Expected: PASS.

### Task 2: Android Local-Only Replay

**Files:**
- Create: `ClipCascade_Mobile/src/LocalClipboardReplay.js`
- Modify: `ClipCascade_Mobile/src/ClipboardActivityLog.js`
- Modify: `ClipCascade_Mobile/src/App.js`
- Modify: `ClipCascade_Mobile/src/StartForegroundService.js`
- Test: `ClipCascade_Mobile/src/__tests__/LocalClipboardReplay.test.js`

- [ ] **Step 1: Write failing one-shot guard tests**

Test that arming a text hash suppresses exactly one matching watcher event, does not suppress a different value, and is consumed without a timeout.

- [ ] **Step 2: Run the focused Jest test and verify RED**

Run: `npm test -- --runInBand src/__tests__/LocalClipboardReplay.test.js`

Expected: FAIL because the guard module does not exist.

- [ ] **Step 3: Implement guard and UI callback**

Implement the one-shot guard, route it through the existing watcher before outbound processing, and add a Lucide copy icon that retrieves private replay text, arms the guard, writes through React Native Clipboard, and reports `Copied locally - not synced`.

- [ ] **Step 4: Run Android focused tests and verify GREEN**

Run: `npm test -- --runInBand src/__tests__/ClipboardEventLog.test.js src/__tests__/LocalClipboardReplay.test.js`

Expected: PASS.

### Task 3: Windows Replay Store And Guard

**Files:**
- Modify: `ClipCascade_Desktop/src/utils/activity_log.py`
- Modify: `ClipCascade_Desktop/src/clipboard/clipboard_manager.py`
- Test: `ClipCascade_Desktop/src/tests/test_activity_log.py`
- Test: `ClipCascade_Desktop/src/tests/test_clipboard_manager.py`

- [ ] **Step 1: Write failing Python tests**

Test private full-text lookup, byte-budget eviction, clearing, and one-shot exact-value suppression before normal duplicate detection.

- [ ] **Step 2: Run focused unittest files and verify RED**

Run: `python -m unittest src.tests.test_activity_log src.tests.test_clipboard_manager -v`

Expected: FAIL because replay APIs do not exist.

- [ ] **Step 3: Implement Windows store and guard**

Add stable event IDs, private replay payloads, bounded eviction, and a clipboard-manager local replay method that arms and consumes the exact-value guard around the OS clipboard write.

- [ ] **Step 4: Run focused unittest files and verify GREEN**

Run: `python -m unittest src.tests.test_activity_log src.tests.test_clipboard_manager -v`

Expected: PASS.

### Task 4: Windows Activity Interaction

**Files:**
- Modify: `ClipCascade_Desktop/src/gui/activity.py`
- Modify: `ClipCascade_Desktop/src/gui/tray.py`
- Modify: `ClipCascade_Desktop/src/core/application.py`
- Test: `ClipCascade_Desktop/src/tests/test_activity_window.py`

- [ ] **Step 1: Write failing selection-policy tests**

Test that Copy is enabled only for selected replayable text rows and that double-click calls the same injected local-copy callback.

- [ ] **Step 2: Run focused UI tests and verify RED**

Run: `python -m unittest src.tests.test_activity_window -v`

Expected: FAIL because the callback and copy command do not exist.

- [ ] **Step 3: Implement the Copy command**

Inject the active clipboard manager through the tray, preserve event IDs in Treeview item IDs, add Copy to the action bar, bind double-click, and show a status label after a successful local-only copy.

- [ ] **Step 4: Run focused UI tests and verify GREEN**

Run: `python -m unittest src.tests.test_activity_window -v`

Expected: PASS.

### Task 5: Full Verification And Publication

**Files:**
- Modify: client version metadata and release documentation identified by the existing release scripts

- [ ] **Step 1: Run complete Android tests and lint**

Run: `npm test -- --runInBand`

Run: `npx eslint App.js ClipboardActivityLog.js ClipboardEventLog.js LocalClipboardReplay.js StartForegroundService.js`

- [ ] **Step 2: Run complete Windows tests**

Run: the repository's full Windows unittest command.

- [ ] **Step 3: Build release artifacts**

Build the Android release APK with JDK 17 and the Windows EXE using the repository release workflow.

- [ ] **Step 4: Install and smoke test both clients**

Verify local-only replay in both directions and verify an ordinary new copy still synchronizes.

- [ ] **Step 5: Synchronize versions and publish**

Bump Android and Windows to the same release version, update release metadata, commit, push `main`, create the GitHub release, and independently verify artifact versions and hashes.
