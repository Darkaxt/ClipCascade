param([ValidateSet('Configure','Release')][string]$Stage = 'Release')
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$evidence = 'D:\Artifacts\ClipCascade\toolchain-20261107'
$scratch = "D:\Temp\clipcascade-toolchain-20261107\$Stage"
$jdk = 'D:\Tools\jdk25-microsoft\jdk-25.0.4.1+1'
New-Item -ItemType Directory -Force -Path $evidence, $scratch | Out-Null
$env:TEMP = $scratch
$env:TMP = $scratch
$env:JAVA_HOME = $jdk
$env:PATH = "$jdk\bin;$env:PATH"
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$gate = "$env:USERPROFILE\.agents\skills\gradle-build-gate\scripts\invoke_gradle_build_gate.py"
$tasks = if ($Stage -eq 'Configure') { @('help') } else {
    @('wrapper', '--gradle-version', '9.8.2', '--distribution-type', 'bin',
      '--gradle-distribution-sha256-sum', '21bd5da2de49b642904077f38c0efdc7778e92b3ed0889392dca61b97e389607',
      ':app:testReleaseUnitTest', ':app:lintRelease', ':app:assembleRelease')
}
$gradleArgs = @(
    '-Dorg.gradle.java.installations.auto-detect=false',
    '-Dorg.gradle.java.installations.auto-download=false',
    "-Dorg.gradle.java.installations.paths=$jdk",
    '--info'
) + $tasks
$ErrorActionPreference = 'Continue'
& python $gate run --project "$repo\ClipCascade_Mobile\src\android" `
    --owner-task "Verify Android $Stage with Gradle 9.8.2 and JDK 25" `
    --gradle-heap-gb 3 --kotlin-heap-gb 3 `
    --log "$evidence\$Stage-$stamp.log" -- @gradleArgs `
    > "$evidence\$Stage-$stamp-result.json"
$result = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($result -ne 0) { throw "Gradle gate failed ($result); evidence: $evidence" }
Write-Output "Verified $Stage; evidence: $evidence; scratch: $scratch"
