# Java 21 Only Build Toolchain

Authorization: already_authorized by the request to use only Java 21.

## Requirements

- R1: Gradle's daemon and all four React Native Gradle plugin JVM toolchains use Java 21, without requiring or provisioning JDK 17.
- R2: Preserve Java/Kotlin bytecode targets, Android SDK/application versions, signing identity, and runtime behavior. Do not uninstall shared JDKs or change other projects.
- R3: Persist dependency changes through the existing versioned patch-package mechanism. Verify application native tests and signed release packaging with Java discovery/download disabled and only the installed JDK 21 available to toolchain selection.
- R4: Document the supported build path, clean disposable verification outputs, and commit the verified result. Deployment and publication are not in scope.
- R5: Additional user request: remove the two obsolete upstream validation clones referencing Gradle 8.14.1 if no longer needed. Preserve the maintained fork, deployment material, credentials, and unrelated temporary files.

## Evidence And Design

The installed React Native 0.80.2 plugin explicitly requests `jvmToolchain(17)` in `shared`, `shared-testutil`, `settings-plugin`, and `react-native-gradle-plugin`. Their explicit Java 11 bytecode targets are separate from the compiler JDK and remain unchanged. The server already targets Java 21.

Use standard Gradle daemon criteria (`toolchainVersion=21`) and extend the existing React Native patch to select JDK 21 in all four modules. The isolated check also found that `JdkConfiguratorUtils.configureJavaToolChains` forces consuming Android/JVM Kotlin projects back to JDK 17. Patch that selection to 21 and explicitly retain their existing Kotlin 17 bytecode target alongside unchanged Java 17 compile options. No React Native, Kotlin, AGP, application, or server version change is required.

## Stages

### 1. Toolchain Migration - COMPLETE

Covers R1, R2, and the reproducibility part of R3. Acceptance: daemon criteria select 21; all four dependency toolchains select 21; existing output targets remain unchanged; restoring the dependency edits and running postinstall reapplies the patch successfully.

Evidence: restored all five patched React Native files to their original contents, then `npm run postinstall` successfully reapplied the versioned patch. Inspection confirms four `jvmToolchain(21)` declarations and unchanged Java/Kotlin 11 output targets. Daemon criteria are pinned to 21.

### 2. Isolated Build Verification - COMPLETE

Covers R2 and R3. Acceptance: the shared gate supervises native tests and signed release packaging; daemon/compiler/test-launcher evidence shows Java 21 with discovery and downloads disabled; APK identity, version, and signing certificate match the existing application. Preserve the pre-existing APK.

Also covers R5: inspect and transactionally remove only the unused `.codex-temp/ClipCascade` and `.codex-temp/ClipCascade-src` validation clones in the Stremio Add-on Tester workspace. Both are clean upstream clones with no ignored files and no observed process command lines referencing them. Their removal is independent of the maintained fork's queued build.

Verification harness corrections: attempts `2794444237224eeaa98700e8f7478469.log`, `c2aa8b668a434f41a5408f3061d10899.log`, and `a3bc3a25faba459f932c40d3423c6cd4.log` stopped before compilation because their settings-provider assertions could not see the supplied restrictions. Inspection of Gradle 9.1.0's `ProviderBackedToolchainConfiguration` confirms it reads Gradle properties. The corrected harness applies temporary `org.gradle.java.installations.*` properties in both the Android root and included React Native build, checks project provider values and resolved compiler metadata, and prints the actual toolchain inventory. These temporary machine-specific properties will be removed after verification. Earlier failures are not passing build evidence.

R5 verified: both pristine upstream clones at `fd2cbbce69d5e5fa6b9b758d13a7dc6efdcb8a39` were relocated to `D:/Temp/clipcascade-retired-upstream-20261011`, revalidated, and transactionally deleted. Transaction `79c5f7e39d8bd34abca65d2d0db6f903` applied all 654 reviewed entries (13,173,932 bytes) without errors. Original clone paths no longer exist; deployment and SSH material remain present. The initial direct registration was rejected because `.codex-temp` is not a recognized disposable-repository root; no helper safeguards were changed.

Build `d165812726e94f669d57509562152443.log` verified all four plugin toolchains and their Kotlin compiler invocations on JDK 21, then correctly failed the application-toolchain assertion because `JdkConfiguratorUtils` selected 17. This identified the additional consuming-project selection described above; fix and reverify in this stage.

Final patch reproducibility: restored all six modified dependency files (including `JdkConfiguratorUtils.kt`) to their upstream contents and successfully reapplied all existing patches with `npm run postinstall`.

Final build evidence: `C:/Users/darka/AppData/Local/Tools/gradle-build-gate/logs/0311df18071f45d1a6fddabde0109d46.log`, exit 0, `BUILD SUCCESSFUL in 6m 23s`. The gate acquired `Local\Darka.AndroidGradleBuildGate` and verified completion. Effective settings were two workers, parallel projects disabled, 3 GiB Gradle and Kotlin daemon heaps, and one 512 MiB test fork. No memory failure occurred. Actual inventory listed only Zulu 21.0.12.1, with auto-detection and auto-download disabled. Both builds' daemon markers, all four plugin toolchains, application/library compiler invocations, and the native test launcher resolved to JDK 21. Runtime test marker confirmed one fork and 512 MiB; native binder test XML reports zero failures/errors/skips.

Compatibility evidence: the generated `MainActivity.class` has class-file major 61 (Java 17); plugin `JdkConfiguratorUtils.class` has major 55 (Java 11). Signed verification APK: 94,564,226 bytes, SHA-256 `06390CE856B7818AFFD713FDBDDDA8E99E6B050237A4BA0E4E03957A1C6F903F`. `aapt` confirms package `com.darkaxt.clipcascade`, version `3.2.0.26` / `3020026`, minimum SDK 26 and target/compile SDK 35. `apksigner verify --print-certs` succeeds with the unchanged certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. The pre-existing release APK remains unchanged at SHA-256 `7C78795E12B62272B9DE9ADECB609CAAB8CF0745DFB8E70CB2DB37FF9B5FCE3C`.

### 3. Reconciliation And Commit - COMPLETE

Covers R4. Acceptance: README reflects the verified Java-21-only path; disposable verification output is transactionally removed; final diff and requirements are reconciled and committed. No deployment or publication.

README now documents daemon/compiler selection and the distinction from bytecode targets. Temporary machine-specific discovery restrictions were removed from the Android root and included build after the stricter verification succeeded; the portable JDK 21 criteria and compiler patch remain. No application implementation, version, SDK, signing, or shared JDK installation was changed.

Verification cleanup transaction `573f495085957a5862b37bac4c965a78` applied all 1,491 eligible entries (378,241,178 bytes) without errors, removing the isolated build and init script. The empty clone-retirement staging directory was initially excluded as pre-existing relative to this transaction; exact generated-output registration in transaction `e0a1ef29d72a62152f2aa575be78bde4` then removed that one empty directory without errors. Build gate logs and this evidence remain; the existing release APK is preserved.

Final reconciliation: R1 is demonstrated by actual JDK inventory/compiler/launcher evidence; R2 by unchanged bytecode, APK metadata, certificate and pre-existing APK digest; R3 by six-file patch replay plus isolated native tests and signed packaging; R4 by README, verified cleanup, diff checks and the completion commit containing this specification; R5 by the reviewed clone retirement and preserved deployment material. No deployment or publication was performed.

Blockers: none. Tracked deferrals: none.
