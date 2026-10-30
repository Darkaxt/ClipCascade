param([Parameter(Mandatory=$true)][string]$ArtifactDirectory, [switch]$WriteSums)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$version = (Get-Content "$repo\version.json" -Raw | ConvertFrom-Json).windows
$reference = "D:\Artifacts\ClipCascade\releases\$version"
$python = 'C:\Users\darka\AppData\Local\Programs\Python\Python311\python.exe'
$sdk = 'C:\Users\darka\AppData\Local\Android\Sdk\build-tools\35.0.0'
$analyzer = 'C:\Users\darka\AppData\Local\Android\Sdk\cmdline-tools\latest\bin\apkanalyzer.bat'
$env:JAVA_HOME = 'C:\Program Files\Zulu\zulu-21'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$names = @("ClipCascade-Android-$version.apk", "ClipCascade-Windows-$version.exe")
$sums = @($names | ForEach-Object { '{0}  {1}' -f (Get-FileHash -LiteralPath (Join-Path $ArtifactDirectory $_)).Hash.ToLowerInvariant(), $_ })
if ($WriteSums) { $sums | Set-Content -LiteralPath "$ArtifactDirectory\SHA256SUMS" -Encoding ascii }
else {
    if (Compare-Object @(Get-Content "$ArtifactDirectory\SHA256SUMS") $sums) { throw 'Downloaded digest mismatch' }
    if (Compare-Object @(Get-Content "$reference\SHA256SUMS") $sums) { throw 'Build/download digest mismatch' }
}
$exe = Join-Path $ArtifactDirectory $names[1]
if ((Get-Item $exe).VersionInfo.FileVersion -ne $version) { throw 'PE version mismatch' }
& $python -B "$repo\tools\verify_windows_package.py" $exe
if ($LASTEXITCODE -ne 0) { throw 'Packaged Windows source mismatch' }
$apk = Join-Path $ArtifactDirectory $names[0]
$parts = $version.Split('.')
$code = [int]$parts[0] * 1000000 + [int]$parts[1] * 10000 + [int]$parts[2] * 100 + [int]$parts[3]
$badging = & "$sdk\aapt.exe" dump badging $apk
if ($LASTEXITCODE -ne 0 -or -not ($badging -match "package: name='com.darkaxt.clipcascade' versionCode='$code' versionName='$version'")) { throw 'APK metadata mismatch' }
if ($badging -contains 'application-debuggable') { throw 'Release APK is debuggable' }
$signer = & "$sdk\apksigner.bat" verify --print-certs $apk
if ($LASTEXITCODE -ne 0 -or -not ($signer -match 'SHA-256 digest: fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c')) { throw 'APK signer mismatch' }
foreach ($class in @('NativeBridgeModule', 'ShizukuClipboardModule', 'ClipboardListenerModule')) {
    $dex = & $analyzer dex code --class "com.darkaxt.clipcascade.$class" $apk
    if ($LASTEXITCODE -ne 0 -or -not ($dex -match 'ClipboardWriteOrigin')) { throw "Packaged native provenance path missing: $class" }
    $dex | Set-Content "$reference\verification\$class-dex.txt"
}
$preview = & $analyzer dex code --class com.darkaxt.clipcascade.NativeBridgeModule --method 'getUiPreviewMode()Ljava/lang/String;' $apk
if ($LASTEXITCODE -ne 0 -or -not ($preview -match 'return-object') -or ($preview -match 'getStringExtra|currentActivity|clipcascade_ui_preview')) { throw 'Release preview guard is not disabled' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($apk)
try {
    $entry = $zip.GetEntry('assets/index.android.bundle')
    $reader = [IO.BinaryReader]::new($entry.Open())
    try { $bundle = [Text.Encoding]::ASCII.GetString($reader.ReadBytes([int]$entry.Length)) } finally { $reader.Dispose() }
    if (-not $bundle.Contains('Clipboard send superseded by connection change')) { throw 'Packaged JS retry/reset fix missing' }
} finally { $zip.Dispose() }
$sums
'Client versions, hashes, Windows source/artwork, Android signer/native provenance and packaged retry guard verified.'
