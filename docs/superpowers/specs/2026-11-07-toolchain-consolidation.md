# Android toolchain consolidation

Authorization: the Saturday toolchain-maintenance assignment for this checkout,
under the shared contract at `D:/Maintenance/Toolchains/README.md`. Existing
product behavior, signing identity, credentials and installed clients are protected.
The central ledger is read-only for this project owner. No device access is needed.

## Requirements

- R1: Evaluate the installed Gradle 9.8.2 and Microsoft JDK 25.0.4.1+1 together
  with the React Native, AGP, Kotlin and included-plugin dependency chain. Prefer
  a coherent build-only migration; investigate newer released alternatives before
  accepting any incompatibility. Pin the official wrapper checksum.
- R2: Preserve clipboard transport, ACK/retry semantics, native backends, legacy
  React Native architecture, min/target SDK, package identity and signer. Update
  build integration only where the selected tools require it. Do not modify the
  running Windows/server clients, install Android, or remove shared toolchains.
- R3: Verify clean patch application, configuration, native unit tests, complete
  release packaging and affected JS contracts through the installed build gate.
  Prove selected JDK/compiler versions rather than inferring them from JAVA_HOME.
  Inspect APK version/signature and packaged native libraries and JS behavior.
- R4: Complete the normal versioned release/delivery workflow for the final scope,
  independently retrieve/verify required assets, preserve user data, and submit an
  immutable report under the assigned shared reporting directory. Clean expendable
  task output using transactional cleanup. Leave the central ledger unchanged.

## Compatibility investigation

Baseline revision: `6526aeded85a7ee0cd5c5a1bbb56563e6b78e29f`; clean main.
Baseline: RN 0.80.2 / React 19.1.0, included AGP 8.9.2 / Kotlin 2.1.20,
Gradle 9.1.0, JDK 21, SDK 35, NDK 29.0.14206865. Existing patch-package
patches remove JCenter, update Foojay to 1.0.0 and select JDK 21 throughout.

Candidate: Gradle 9.8.2 / Microsoft JDK 25.0.4.1+1 / Kotlin 2.4.21 /
AGP 9.3.1, retaining RN 0.80.2 runtime. Kotlin's published fully-tested
Gradle ceiling is 9.7.0, not 9.8.2; this is an explicit verification risk, not
proof of incompatibility. Its AGP ceiling is 9.3.1. AGP 9.3 needs Gradle 9.5+
and Build Tools 36.0.0. Official AGP 9 opt-outs preserve the old plugin DSL and
external Kotlin integration required by the existing native modules.

RN 0.88.1 (npm latest verified 2026-11-07) supplies AGP 9.2.1 / Kotlin 2.2.0,
requires React 19.3 and newer Node, and is new-architecture-only. Upstream advises
migrating through RN 0.81 and proving the new architecture before 0.82+. This is
a viable broader migration, not a technical blocker. It is unnecessary if the
existing build-only patch can support the requested installed tools. AGP 8.13.2 /
Kotlin 2.3.21 is another narrower alternative with a lower fully-tested Gradle
ceiling; do not claim the current pins rule out that route.

Primary sources (observed 2026-11-07):
- https://docs.gradle.org/current/userguide/compatibility.html
- https://services.gradle.org/distributions/gradle-9.8.2-bin.zip.sha256
- https://kotlinlang.org/docs/gradle-configure-project.html
- https://developer.android.com/build/releases/agp-9-3-0-release-notes
- https://developer.android.com/build/releases/agp-9-0-0-release-notes
- https://developer.android.com/build/releases/agp-8-13-0-release-notes
- https://developer.android.com/build/kotlin-support
- https://reactnative.dev/blog/2025/10/08/react-native-0.82
- https://raw.githubusercontent.com/facebook/react-native/v0.88.1/packages/gradle-plugin/gradle/libs.versions.toml

## Stages and reconciliation

1. Integrated toolchain migration - COMPLETE (R1-R3). Implement the complete
   build-only dependency adjustment and verify release/native/JS contracts.
   Verified by the final gated release run and packaged-client checks below.
2. Final release and reporting - COMPLETE (R4). Reconcile scope, commit,
   publish matching versioned artifacts, independently verify delivery and submit
   the immutable report. No intermediate publication.

Final acceptance: commit/publication, independent download verification, immutable
owner report and transactional cleanup are satisfied. No unresolved blockers.
No tracked deferrals. No active fault in installed clients is inferred.

Evidence and current results will be recorded here at meaningful checkpoints.
Clean patch reversal/reapplication passed with patch-package. First configuration
proved Gradle 9.8.2 and Microsoft JDK 25 with the gated resource profile, then
failed because RNGP's Java 11 compile variant cannot consume AGP 9.3.1's Java 17
variant. Aligning the build plugin's Java/Kotlin output to 17 addresses that exact
dependency contract; app bytecode remains Java 17. Evidence: Configure-20261107-101822
under `D:/Artifacts/ClipCascade/toolchain-20261107`.
The next configuration passed the variant boundary but npm 12.2.2's Windows
`npx` shim failed to execute the installed CLI (`'"rnc-cli"' is not recognized`).
The supported explicit RN autolink command now runs that same local JS entrypoint
with Node, avoiding the broken shim without package downloads or policy changes.
The AGP 9.3.1/Kotlin 2.4.21 attempt then reached plugin compilation and exposed
AGP 9 DSL generic-type changes across RN 0.80's ReactPlugin, AGP, JDK and NDK
configuration utilities. A typed DSL port is possible, not an impossibility,
but is a broader integration change than needed for this consolidation.
Selected narrower candidate: Gradle 9.8.2 / JDK 25 / AGP 8.13.2 / Kotlin 2.3.21.
AGP 8.13.2 explicitly supports Kotlin 2.3; Kotlin 2.3 supports Java 25. Kotlin's
fully-tested Gradle ceiling is 9.3, so real verification of 9.8.2 remains required.
The unused AGP 9 opt-outs are removed. Java 17 plugin output remains appropriate
for Gradle 9; the Android runtime architecture and SDK targets remain unchanged.
Primary source: https://kotlinlang.org/docs/whatsnew23.html
Correction from the next actual build: AGP 8.13.2 also has an unbounded DSL
parameter in `AndroidComponentsExtension`; the problem is not exclusive to AGP 9.
`javap` of its installed gradle-api jar confirms this contract. The app/library
callbacks now use one explicitly typed components accessor for their known
`CommonExtension` DSL, retaining existing callback bodies and lifecycle ordering.
The AGP 8 candidate avoids AGP 9's separate built-in Kotlin/legacy-DSL transition.
The typed plugin then compiled successfully, but AGP 8.13.2 itself failed to apply
because it uses Gradle's InternalProblems API removed in 9.6. This is a concrete
version boundary, also documented by Gradle, not a blanket incompatibility claim.
Return to AGP 9.3.1 / Kotlin 2.4.21 with the now-explicit common DSL binding
(AGP 9's CommonExtension is no longer generic) and the official legacy opt-outs.
Source: https://docs.gradle.org/current/userguide/upgrading_version_9.html#agp_8x_incompatible
AGP 9's plugin now compiles and applies. App configuration exposed the removed
`proguard-android.txt` template; use `proguard-android-optimize.txt`, leaving
minification disabled as before. Proceed directly to the integrated release
verification tasks, which also verify complete project configuration.
The first integrated attempt found AGP 9's disabled-by-default resource-value
feature. RNGP declares dev-server resValues; explicitly enable that feature in
the existing dev-server DSL callback, preserving the previous generated resources.
Library namespace inference exposed AGP 9's old `AndroidLibrarySourceSet` cast.
Use the already-bound CommonExtension sourceSets instead of retrieving legacy
LibraryExtension; retain the same manifest, namespace parsing and lifecycle.
That public DSL exposes only the manifest setter, not a getter; the attempted
replacement did not compile and is superseded. Complete the standard explicit
namespace migration instead: AES = com.reactnativeaesgcmcrypto, PBKDF2 =
com.reactnativepbkdf2, matching their exact existing manifests. All other linked
libraries already declare namespaces. Remove RNGP's unsupported inference path;
AGP remains responsible for rejecting any future library missing its namespace.
Verification correction: earlier git apply checks were run from a subdirectory
and silently skipped node_modules paths. They are not clean-install evidence.
The temporary baseline derived that way is superseded. Exact registry packages
were retrieved by pinned names (scripts disabled, existing npm policy unchanged),
their SHA-512 identities matched the project lockfile, all three patches were
regenerated from those originals, applied in an isolated dependency tree, and
compared with actual build inputs. Receipt: patch-validation-105747.json under
the retained toolchain evidence directory. All linked projects now configure.
AGP 9 changed unit-test generation to the tested build type only; explicitly set
android.onlyEnableUnitTestForTheTestedBuildType=false to preserve release native
contracts rather than omitting them from verification.
Native provenance, observation and Shizuku binder contracts passed on JDK 25.
Lint found three remaining integration issues: declare the app's directly used
Notifee core service dependency explicitly at the same vendored runtime version
202108261754 (the class is present in the old signed APK); qualify the API-27
navigation-bar attribute while retaining the base theme for API 26; escape the
existing local SDK drive separator without changing its path. A focused resource
contract reproduces the missing qualification and verifies the shared theme.
Final stage-1 acceptance evidence (2026-11-07):
- Release-20261107-110719-result.json: build success, gate/profile/test-failure
  policy verified, two workers, 3 GB heaps, no parallel projects, one 512 MB test
  fork, Gradle daemon exit verified. Native execution uses Microsoft JDK 25;
  earlier full compilation logs explicitly identify its javac toolchain.
- Native observation/provenance/binder contracts pass; lint has 0 errors and
  38 existing warnings. JS contracts pass across the full run and an unchanged
  focused rerun of one cold-start UI test that exceeded Jest's five-second limit.
  Desktop regression run's sole metadata mismatch was corrected and focused
  version/resource contracts pass. No production clipboard logic changed.
- Official Gradle wrapper JAR checksum matches
  3b8a25775a69158b5ad2b1d17a80a88dc7b40a352a73eb27d06c612a7ce68e98.
- Packaged local client verification passes: APK 3.2.0.36 / code 3020036,
  min SDK 26, target SDK 35, four ABIs, original certificate; all 40 native
  libraries match 3.2.0.35 exactly. Native provenance and JS retry guard remain
  packaged. Windows source modules and 52 control assets match the checkout.
- Local hashes and detailed package checks are retained under
  D:/Artifacts/ClipCascade/releases/3.2.0.36/verification/packaged-local.log.
Stage-2 pre-publication checkpoint: all local package gates pass. Task scratch at
D:/Temp/clipcascade-toolchain-20261107 and D:/Temp/clipcascade-retry-3.2.0.36 was
removed through transactions e3e7acd4966aae63eaa55ba6facb3a80 and
0d860c62cdbd2fa7d5241b499b9511f2 (115998065 logical bytes total). Both receipts
are applied, with no residual roots. Retained verification evidence and release
assets are outside these targets. Shared caches/toolchains remain untouched.
Final delivery: normal release 3.2.0.36 was published at 2026-11-07T09:22:01Z
from 7f5c633a6ebcaa3061e10bbae298cf5b79ceffa1. Tag/source commit, publication
state and all required assets were read back. Client version consistency, CodeQL
and Dependency Graph runs succeeded for that commit. Independently downloaded
APK/EXE and SHA256SUMS passed the same package gates; all 40 native library
payloads still match 3.2.0.35. Delivery evidence is retained under the release's
verification directory. Release link:
https://github.com/Darkaxt/ClipCascade/releases/tag/3.2.0.36

Immutable report 20261107T092501Z-gradle982-jdk25.json was published under the
assigned shared owner-report directory using a complete sibling file and a
non-overwriting atomic move. The central ledger was not edited by this owner.
Delivery scratch E:/Temp/clipcascade-toolchain-delivery-20261107 was removed by
applied transaction 9935b7cb27334f02b39029d2ac207bb7 (160726714 logical bytes).
All three task scratch roots are absent. Installed clients, server, credentials,
signing identity and user data were preserved; no device access occurred.
This documentation-only completion record does not change the released payload.
New bulk build scratch uses `D:/Temp/clipcascade-toolchain-20261107` for sustained
small-file I/O; retained release evidence belongs under `D:/Artifacts/ClipCascade`.
Existing C: repository and required node_modules/app output bindings are preserved.
