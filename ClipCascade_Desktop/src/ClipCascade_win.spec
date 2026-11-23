# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('../../logo/window-icon.ico', 'logo'),
        ('../../logo/window-icon.png', 'logo'),
        ('../../logo/ui/*.png', 'logo/ui'),
        ('../../logo/ui/LUCIDE-LICENSE', 'logo/ui'),
    ],
    hiddenimports=['plyer.platforms.win.notification'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='ClipCascade',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    # Keep the onefile runtime out of %TEMP%: Windows Storage Sense/SilentCleanup deletes
    # extracted files a long-running client has not touched for days (Tk scripts, icons).
    # The Windows bootloader expands environment variables in this path.
    runtime_tmpdir=r'%LOCALAPPDATA%\ClipCascade\runtime',
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['../../logo/window-icon.ico'],
    version='version_info.txt',
)
