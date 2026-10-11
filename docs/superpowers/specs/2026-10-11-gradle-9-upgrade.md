# Android Gradle 9 upgrade

Authorization: already_authorized by the request to review and upgrade Gradle to
an already available version greater than 9.

## Requirements

- R1: Use an installed stable Gradle 9.x distribution. Initial target: 9.1.0,
  already installed and referenced by another local React Native project.
  Pin the official distribution SHA-256 and regenerate the wrapper components.
- R2: Preserve React Native behavior, SDK targets, signing, credentials, app
  versions, and existing deliverables. Change build plugins or native dependency
  integration only when compatibility evidence requires it. No server changes,
  device installs, publication, global configuration changes, or cache cleanup.
- R3: Verify Gradle configuration, the Android native unit test, and a signed
  release APK using the shared Windows build gate, two workers, no parallel
  projects, 3 GB Gradle/Kotlin heaps, and at most one test fork. Inspect effective
  profile evidence; do not infer compatibility from an installed version.
- R4: Document compatibility findings, focused verification, and local developer
  build instructions. Commit the verified upgrade without pushing or releasing.
  Remove task-owned disposable verification outputs after inspection.

## Review

Baseline: Gradle 8.14.1, React Native 0.80.2, its included AGP 8.9.2 and Kotlin
2.1.20, existing Zulu JDK 21. Gradle 9 requires JDK 17+, AGP 8.4+, and Kotlin
Gradle plugin 2.0+. The existing plugins meet those minimums but Kotlin's fully
tested compatibility range does not cover Gradle 9; actual integration proof is
required. Newer installed 9.4.1/9.6.x/9.7.1/9.8.0 are not automatically compatible.

The first gated Gradle 9.1.0 configuration failed because React Native's included
Foojay resolver 0.5.0 references the removed `JvmVendorSpec.IBM_SEMERU` field.
Resolver 1.0.0 removes that reference. A single-file patch-package patch updates
the included build's settings; postinstall applies it with error-on-fail. Patch
reapplication to the original settings file passed. React Native, AGP, Kotlin,
SDK targets, and app versions remain unchanged.

After the resolver fix, React Native's included build plugins compiled but project
configuration failed at `react-native-aes-gcm-crypto`'s removed `jcenter()` method.
The PBKDF2 module contains the same removed calls. Remove those repository calls
in versioned package patches; preserve the libraries and their Maven Central/
Google repositories. Gradle 10 deprecation warnings are not Gradle 9 blockers and
do not authorize an unrelated AGP/native-library migration.

Sources:
- https://docs.gradle.org/current/userguide/upgrading_major_version_9.html
- https://kotlinlang.org/docs/gradle-configure-project.html
- https://services.gradle.org/distributions/gradle-9.1.0-bin.zip.sha256
- https://github.com/gradle/foojay-toolchains/blob/main/CHANGELOG.md

## Stages

1. Toolchain configuration - COMPLETE. R1-R2: select installed baseline, configure
   checksum-pinned wrapper, resolve evidenced compatibility failures, and verify
   Gradle configuration/wrapper generation through the gate.
2. Android verification - COMPLETE. R3: native unit test and signed release
   packaging pass; inspect APK identity and effective gate/resource evidence.
3. Documentation and commit - COMPLETE. R4: document findings, clean only
   disposable task outputs, reconcile requirements, and commit verified changes.

Blockers: none. Tracked deferrals: none.

Stage 1 evidence: wrapper task completed on Gradle 9.1.0; rewriting the running
Windows batch file produced a shell error after Gradle's successful exit. A fresh
gated `--no-daemon help --warning-mode summary` launch then passed with exit 0
(ticket 581, log `9686199314fc42a3a7d39c4ebbae4c1b.log`). Gate markers verified
two workers, no parallel projects, and a 3 GiB Gradle heap. Live Kotlin compiler
daemon command line during included-plugin compilation also showed `-Xmx3g`.
All three patches reapplied successfully from the original package settings.

Stage 2 evidence: gated `:app:testReleaseUnitTest :app:assembleRelease` passed
with exit 0 on Gradle 9.1.0 (ticket 587, log
`688c30a09a844df1bb7799ff9e8b79b5.log`). Both Android 13 and Android 14+ Shizuku
binder contract tests passed, with no failures, errors, or skips in JUnit XML.
The gate verified two workers, parallel disabled, a 3 GiB Gradle heap, and test
configuration of one fork / 512 MiB / fail-fast / no ignored failures. Live Kotlin
daemon PID 52620 also had `-Xmx3g`. No memory failure was reported. No CMake/Ninja
compile tasks ran; the native environment budget is not claimed as measured
compiler concurrency. Hermes bundling, release lint, dexing, and signing passed.

Verification app output was redirected without modifying project configuration.
The initial D: output failed React Native's Windows `cliPath` / `relativeTo`
same-volume requirement; the successful run used an isolated C: Temp directory.
The temporary init script remains on D: until reviewed cleanup.

APK verification: package `com.darkaxt.clipcascade`, version `3.2.0.26` /
`3020026`, min SDK 26, compile/target SDK 35, 94,564,226 bytes, valid v2 signature.
Certificate SHA-256 matches the existing APK:
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
Verification APK SHA-256:
`5EA713EBDF24C3A0FEE07D636A317BF8553B64D3D80E8AE8788F3DB75902FC7B`.
Existing tracked APK SHA-256 remains unchanged:
`7C78795E12B62272B9DE9ADECB609CAAB8CF0745DFB8E70CB2DB37FF9B5FCE3C`.

## Final reconciliation

- R1: Wrapper distribution and JAR match official Gradle 9.1.0 SHA-256 values.
  Generated JAR SHA-256:
  `76805e32c009c0cf0dd5d206bddc9fb22ea42e84db904b764f3047de095493f3`.
- R2: Changes are limited to wrapper components, three build-only npm patches,
  their installer/lockfile, and documentation. App versions, runtime source,
  signing identity, existing APK, and server/device state are unchanged.
- R3: Configuration, native tests, and signed release packaging passed as above.
  This verifies the requested build paths, not every possible Gradle task or
  on-device runtime behavior. No JS behavior changed, so unrelated Jest suites
  and device deployment were not added to this toolchain verification.
- R4: README documents prerequisites and the gated build. Reviewed transactional
  cleanup removed both isolated verification directories, including the temporary
  APK and init script, reclaiming 378,244,126 bytes. Both transactions finished
  in `applied` state with no errors; existing artifacts and shared caches remain.
  CRLF-aware source/documentation whitespace checks passed. Unified-diff patch
  files intentionally contain space-prefixed blank context lines; they are
  verified by successful patch application rather than stripping that syntax.
  The verified upgrade is committed locally, without push or release.

No blockers or tracked deferrals remain. Gradle 10 deprecations remain explicitly
outside this Gradle 9 upgrade. Kotlin 2.1.20's upstream fully-tested range remains
narrower than this exact locally verified combination.
