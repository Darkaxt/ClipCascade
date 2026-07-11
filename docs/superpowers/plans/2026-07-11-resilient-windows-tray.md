# Resilient Windows Tray Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the ClipCascade Windows tray icon registered across display and shell transitions without restarting the clipboard client.

**Architecture:** A Windows-only `ResilientIcon` subclass owns checked native registration and event-driven recovery. `gui.tray` selects this class on Windows and retains the upstream `pystray.Icon` everywhere else.

**Tech Stack:** Python 3.11, pystray 0.19.5, ctypes Win32 bindings, unittest, PyInstaller

---

### Task 1: Reproduce the registration failure in tests

**Files:**
- Create: `ClipCascade_Desktop/src/utils/resilient_tray.py`
- Create: `ClipCascade_Desktop/src/tests/test_resilient_tray.py`

- [ ] **Step 1: Write failing tests**

Create tests that call the desired display-change and taskbar-created handlers with an injected notifier. Assert that display changes never issue `NIM_DELETE`, failed modifies issue `NIM_ADD`, and failed adds are logged.

- [ ] **Step 2: Verify the tests fail**

Run: `python -m unittest tests.test_resilient_tray -v`

Expected: FAIL because `utils.resilient_tray` does not exist.

### Task 2: Implement checked event-driven recovery

**Files:**
- Create: `ClipCascade_Desktop/src/utils/resilient_tray.py`
- Modify: `ClipCascade_Desktop/src/gui/tray.py`

- [ ] **Step 1: Implement the minimal wrapper**

Subclass `pystray.Icon` on Windows, replace the display-change and taskbar-created handlers, return and inspect `Shell_NotifyIcon`, and log failed native operations.

- [ ] **Step 2: Select the wrapper on Windows**

Import `ResilientIcon` in `gui.tray` and use it for the existing `ClipCascade` icon. Keep upstream `Icon` for other platforms.

- [ ] **Step 3: Verify focused tests pass**

Run: `python -m unittest tests.test_resilient_tray -v`

Expected: all resilient tray tests PASS.

### Task 3: Verify and ship

**Files:**
- Modify: `ClipCascade_Desktop/src/pyproject.toml`
- Modify: `ClipCascade_Desktop/src/core/constants.py`
- Modify: `version.json`
- Modify: `README.md`

- [ ] **Step 1: Run the full desktop test suite**

Run: `python -m unittest discover -s tests -v`

Expected: all tests PASS.

- [ ] **Step 2: Bump the Windows version and release notes**

Advance the Windows client patch version and document resilient tray recovery.

- [ ] **Step 3: Build and install**

Run the existing PyInstaller Windows build, replace the installed executable, and start ClipCascade through its normal startup path.

- [ ] **Step 4: Verify native recovery**

Remove the native notification registration, send `TaskbarCreated`, and confirm the white clipboard returns with unchanged process identity and active server connections.

- [ ] **Step 5: Commit, push, and publish**

Commit the source, tests, docs, and version metadata; push `main`; create the matching GitHub release with the Windows executable.
