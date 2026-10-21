# Android Background Monitoring Tick Recovery

## Evidence And Scope

Samsung RFCY80551LT, Android 17, installed 3.2.0.29: watchdog probes at
14:40 and 14:57 failed with phase=waiting_tick (116391/1099802 ms). Headless
restart handlers executed, but the replacement foreground run did not start.
The previous run is waiting on React Native setTimeout; lifecycle replacement
waits for that run to finish. Server probe callbacks still respond. This is a
local scheduling/lifecycle defect, not evidence of lost credentials or Wi-Fi.

## Requirements

- B1: Preserve the existing one-second service polling cadence using an Android
  Handler-delivered promise, not React Native UI/frame-driven timers.
- B2: Superseding a run wakes its pending polling wait immediately. Transport
  cleanup completes before a replacement run starts, with no concurrent runs.
- B3: Cancellation cannot leak wait listeners; native pending ticks are removed
  when the module is destroyed. Offline transport recovery and strict Shizuku
  behavior remain unchanged. Do not suppress genuine monitoring failures.
- B4: Reproduce suspended JS timers and replacement recovery in focused tests;
  compile/sign Android with Java 21 via the shared build gate. Publish a matching
  Android-only versioned release, independently check version/hash/signer and
  relevant packaged behavior. Preserve data and signer. Never auto-install on
  the user's Android devices; device endurance verification is user-owned.

## Stages

1. Integrated native tick and cancellation fix: COMPLETE (B1-B3).
   Full mobile tests pass, including suspended-JS-timer cancellation, native tick
   wiring, transport recovery, strict Shizuku, replay and watchdog integration.
   ESLint has no errors (existing StartForegroundService warnings unchanged).
   Local React Native JavaTimerManager confirms timers stop when host is paused
   and no headless JS task is active; a foreground Android notification alone
   does not establish an active HeadlessJsTaskContext task.
2. Verification, Android-only release and download proof: ACTIVE (B4).
   Pre-publication gates passed: mobile suite, ESLint (no errors), per-platform
   metadata consistency, signed assembleRelease, built APK versionCode 3020031 /
   versionName 3.2.0.31, original signer and all four existing ABIs preserved.
   APK dex inspection shows waitForServiceTick uses Handler.postDelayed(1000),
   and its Hermes bundle contains both native tick and cancellable-wait names.
   Gradle FIFO ticket 1638 acquired the shared gate; Java 21, observed 3 GiB
   Gradle heap, two workers, no parallel tasks. Kotlin 3 GiB budget was requested;
   no separate compiler heap observation is claimed. No Gradle tests were run
   (Jest covers JS); native concurrency is not independently measured. Build and
   supervisor exit codes were 0; post-build daemon exit was verified. The app's
   live display title was unavailable, so the gate label remained Unknown.

No tracked deferrals. Windows/server remain unchanged.
