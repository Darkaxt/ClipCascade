# NDK r29 Consolidation

Authorization: already_authorized by the Drives Maintenance request to assess and migrate owned toolchains to installed NDK r29 when compatible, verify, and commit. No deployment, device installation, release, or shared SDK/cache removal.

## Requirements

- R1: Assess the actual native build and React Native 0.80.2 architecture before replacing `27.1.12297006` with `29.0.14206865`.
- R2: Preserve Java 21 migration, runtime behavior, SDK/API levels, ABIs, application version, signing identity, existing release APK, and dirty work. Do not enable the new architecture as part of toolchain consolidation.
- R3: Verify the effective installed NDK through the shared Windows Gradle gate, native processing, release packaging, native unit tests, and APK identity/native library inspection. A version-string edit alone is not acceptance evidence.
- R4: Document remaining owned references/retained worktrees and retirement limits; clean disposable verification outputs and commit. Do not uninstall shared versions or remove rollback/offline resources.

## Assessment

The maintained checkout is clean at `cbe131c`; `git worktree list --porcelain` reports only this checkout. Both obsolete upstream validation clones were already transactionally removed in the Java 21 task. No owned script or current source pin other than root `android/build.gradle` requests `27.1.12297006`; `app/build.gradle` inherits that value.

`newArchEnabled` and `react.newArchEnabled` are absent from the project, current environment and inspected user Gradle properties. React Native's `ProjectUtils.isNewArchEnabled` requires an explicit true property; `NdkConfiguratorUtils` skips CMake setup when false. Therefore the shipping build uses prebuilt React/Hermes/WebRTC native libraries, not source C++ compilation. New-architecture C++ compatibility with r29 will not be claimed from this build. Enabling that architecture would change runtime contracts and is outside this consolidation.

Installed r29 `source.properties` confirms `Pkg.Revision = 29.0.14206865`. The old exact pin is not installed in the C: SDK. The [official r29 changelog](https://github.com/android/ndk/wiki/Changelog-r29) documents a newer LLVM toolchain; no local custom CMake/ndk-build tool integration requires removed macOS-only tooling. Validate the actual native stripping/packaging path rather than asserting unsupported source-build compatibility.

## Stages

### 1. Assessment And Migration - COMPLETE

Covers R1 and configuration part of R2. Acceptance: document actual architecture/native tasks and installed revision; change only the root NDK pin, preserving all other build/runtime settings.

Evidence: root pin changed to installed r29; all other application/toolchain configuration remains unchanged. Prior Java 21 build log `0311df18071f45d1a6fddabde0109d46.log` reports missing `27.1.12297006` and native libraries packaged without stripping because no matching strip tool was available. The migration must verify actual r29 processing, not merely another successful unstripped packaging fallback.

### 2. Release Verification - COMPLETE

Covers R2 and R3. Acceptance: gated build resolves installed r29; native processing and release packaging succeed without downloading the old NDK; native unit tests pass; APK package/version/API/signature and native ABI/library inventory remain compatible; existing release APK digest remains unchanged.

Evidence: gated `:app:testReleaseUnitTest :app:assembleRelease --info` passed, exit 0, `BUILD SUCCESSFUL in 5m 11s`. Log: `C:/Users/darka/AppData/Local/Tools/gradle-build-gate/logs/386101cf2247472c9c60187208bafd59.log`. Gate ticket `2d167b584b404c20af1bbe3e64fd41fa` acquired `Local\Darka.AndroidGradleBuildGate` and verified process completion. Actual settings: Java 21; two Gradle workers, parallel projects disabled, 3 GiB Gradle heap; one 512 MiB native test fork. Gate retained the 3 GiB Kotlin daemon budget; no memory failure or budget increase occurred. Metro invocation used two workers. No source C++ compiler/Ninja job ran because new architecture remains disabled.

`NDK29_SELECTED` resolved the installed `29.0.14206865`; log records 40 actual r29 `llvm-strip --strip-unneeded` process launches and zero unable-to-strip warnings. Old `27.1.12297006` remains absent from the SDK after verification. Binder native unit tests report zero failures/errors/skips, and runtime test-launcher marker confirms Java 21, one fork, 512 MiB heap.

APK inspection: package `com.darkaxt.clipcascade`; version `3.2.0.26` / `3020026`; minimum SDK 26 and target/compile SDK 35. Signature verifies with unchanged certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Candidate is 94,564,226 bytes, SHA-256 `357F0A53DCA6EF75A161F849C361BD5F5E4DEBBCC7DED06B4A9B339CC1A96A55`. Structured ZIP entry/SHA-256 comparison against the preserved release APK finds exactly the same 40 native libraries across `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64`; every library is byte-identical, so native code, dynamic symbols, linkage and ABI payloads are unchanged. The input prebuilt libraries were already stripped; running the installed strip tool does not alter them.

### 3. Reconciliation And Commit - COMPLETE

Covers R4. Acceptance: README and evidence state verified scope and remaining references; disposable outputs are transactionally removed; final diff passes checks and is committed. Older shared NDK retirement remains subject to other consumers.

Remaining reference boundary: maintained root pin is r29; app and react-native-svg inherit it. No linked worktrees or retained Android validation clones exist. Retained `.codex-temp/clipcascade-deploy` server compose/Docker/setup material and `clipcascade-docker-classes` contain no NDK references in inspected build/scripts. React Native's upstream installed `node_modules/react-native/gradle/libs.versions.toml` still records default `27.1.12297006` for building ReactAndroid itself; its `ReactAndroid/build.gradle.kts` accepts the root override, and ClipCascade consumes the published AAR instead. Do not edit this inactive upstream default merely to erase a historical reference. Git history and this migration record also retain the old value intentionally.

Retirement: ClipCascade's current shipped architecture no longer requests or needs to download `27.1.12297006`; rollback to the previous pin would restore the old selection. It has no current consumer for the other installed older NDK revisions. This is not global retirement clearance: other projects and explicit offline/rollback reservations must be assessed by their owners. No shared NDK/cache was removed. New-architecture r29 source compatibility is unverified and is not claimed as a delivered capability.

Final reconciliation: R1 is satisfied by the architecture/dependency assessment and installed revision evidence; R2 by the preserved Java 21 migration, unchanged application configuration, signed APK metadata and all 40 byte-identical native payloads; R3 by actual r29 strip launches, passed native tests and release packaging; R4 by README, reference/retirement review, cleanup and the completion commit containing this specification. The preserved existing APK still hashes to `7C78795E12B62272B9DE9ADECB609CAAB8CF0745DFB8E70CB2DB37FF9B5FCE3C`.

Cleanup transaction `798f29f92dac0457307302e463089bf6` reviewed all 1,483 entries under the two exact task-output roots and applied all candidates, deleting 378,119,085 bytes without errors/exclusions. The isolated APK, init script and temporary comparison script/output are removed; build logs and this verification record remain. Final diff checks pass. No deployment, release, push, installation or shared toolchain removal was performed.

Blockers: none. Tracked deferrals: none.
