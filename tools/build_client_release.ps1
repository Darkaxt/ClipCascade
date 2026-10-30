param([Parameter(Mandatory=$true)][ValidateSet('Verify','Android','Windows')][string]$Stage)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$versions = Get-Content (Join-Path $repo 'version.json') -Raw | ConvertFrom-Json
$version = $versions.windows
if ($versions.android -ne $version) { throw 'This client release requires matching Android/Windows versions' }
$release = "D:\Artifacts\ClipCascade\releases\$version"
$scratch = "D:\Temp\clipcascade-retry-$version\$Stage"
New-Item -ItemType Directory -Force -Path $scratch, "$release\verification" | Out-Null
$env:TEMP = $scratch
$env:TMP = $scratch
$python = 'C:\Users\darka\AppData\Local\Programs\Python\Python311\python.exe'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if ($Stage -eq 'Verify') {
    Push-Location "$repo\ClipCascade_Desktop\src"
    try {
        $ErrorActionPreference = 'Continue'
        & $python -B -m unittest discover -s tests *> "$release\verification\desktop-tests-$stamp.log"
        $result = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
        if ($result -ne 0) { throw 'Desktop verification failed; inspect saved test log' }
    } finally { Pop-Location }
    Push-Location "$repo\ClipCascade_Mobile\src"
    try {
        $ErrorActionPreference = 'Continue'
        & node node_modules/jest/bin/jest.js --runInBand --silent --cacheDirectory "$scratch\jest" *> "$release\verification\mobile-tests-$stamp.log"
        $result = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
        if ($result -ne 0) { throw 'Mobile verification failed; inspect saved test log' }
    } finally { Pop-Location }
    & $python -B "$repo\tools\verify_windows_clipboard.py" --read-only *> "$release\verification\native-acquisition-$stamp.json"
    if ($LASTEXITCODE -ne 0) { throw 'Native read-only clipboard acquisition verification failed' }
} elseif ($Stage -eq 'Android') {
    $env:JAVA_HOME = 'C:\Program Files\Zulu\zulu-21'
    $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
    $env:CMAKE_BUILD_PARALLEL_LEVEL = '2'
    $env:NINJA_NUM_JOBS = '2'
    $log = "$release\verification\android-build-$stamp.log"
    $ErrorActionPreference = 'Continue'
    & python C:\Users\darka\.codex\skills\gradle-build-gate\scripts\invoke_gradle_build_gate.py run --project "$repo\ClipCascade_Mobile\src\android" --owner-task "Verify retry-loop native contracts and package Android $version" --gradle-heap-gb 3 --kotlin-heap-gb 3 --log $log -- :app:testReleaseUnitTest :app:assembleRelease
    $result = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($result -ne 0) { throw "Gradle gate failed: $result" }
    Copy-Item -LiteralPath "$repo\ClipCascade_Mobile\src\android\app\build\outputs\apk\release\app-release.apk" -Destination "$release\ClipCascade-Android-$version.apk"
} else {
    $env:PYINSTALLER_CONFIG_DIR = "$scratch\pyinstaller-cache"
    Push-Location "$repo\ClipCascade_Desktop\src"
    try {
        $ErrorActionPreference = 'Continue'
        & $python -B -m PyInstaller --noconfirm --workpath "$scratch\work" --distpath $release ClipCascade_win.spec *> "$release\verification\windows-build-$stamp.log"
        $result = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
        if ($result -ne 0) { throw 'PyInstaller failed; inspect saved build log' }
    } finally { Pop-Location }
    Move-Item -LiteralPath "$release\ClipCascade.exe" -Destination "$release\ClipCascade-Windows-$version.exe" -Force
    & $python -B "$repo\tools\verify_windows_package.py" "$release\ClipCascade-Windows-$version.exe"
    if ($LASTEXITCODE -ne 0) { throw 'Packaged Windows source verification failed' }
}
Write-Output "Completed $Stage for client release $version; artifacts: $release; task scratch: $scratch"
