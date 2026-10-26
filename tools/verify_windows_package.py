"""Verify released clipboard modules against the exact current source."""

import hashlib
import json
from pathlib import Path
import sys
import types

from PyInstaller.archive.readers import CArchiveReader


def normalize(code):
    constants = tuple(normalize(value) if isinstance(value, types.CodeType) else value
                      for value in code.co_consts)
    return code.replace(co_filename="verified-source", co_consts=constants)


def main():
    executable = Path(sys.argv[1]).resolve()
    src = Path(__file__).resolve().parents[1] / "ClipCascade_Desktop" / "src"
    archive = CArchiveReader(str(executable))
    pyz = archive.open_embedded_archive("PYZ.pyz")
    modules = ["clipboard.windows_access", "clipboard.clipboard_manager",
               "clipboard.clipboard_monitor_win", "core.constants",
               "stomp_ws.stomp_manager", "utils.clipboard_delivery", "p2p.p2p_manager",
               "gui.activity", "gui.theme", "gui.login", "gui.info", "gui.tray",
               "utils.activity_presentation", "utils.activity_replay"]
    for name in modules:
        actual = pyz.extract(name)
        source = src.joinpath(*name.split(".")).with_suffix(".py")
        expected = compile(source.read_bytes(), str(source), "exec", dont_inherit=True)
        if normalize(actual) != normalize(expected):
            raise RuntimeError(f"Packaged code does not match source: {name}")
    for asset in ["window-icon.ico", "window-icon.png"]:
        name = next(key for key in archive.toc if key.replace("\\", "/") == "logo/" + asset)
        if archive.extract(name) != (src.parents[1] / "logo" / asset).read_bytes():
            raise RuntimeError(f"Packaged icon changed: {asset}")
    controls = list((src.parents[1] / 'logo' / 'ui').glob('*.png'))
    controls.append(src.parents[1] / 'logo' / 'ui' / 'LUCIDE-LICENSE')
    for asset in controls:
        name = next(key for key in archive.toc if key.replace('\\', '/') == 'logo/ui/' + asset.name)
        if archive.extract(name) != asset.read_bytes():
            raise RuntimeError(f'Packaged control artwork changed: {asset.name}')
    print(json.dumps({
        "ok": True, "file": str(executable), "bytes": executable.stat().st_size,
        "sha256": hashlib.sha256(executable.read_bytes()).hexdigest(),
        "source_matched_modules": modules,
        "control_assets_verified": len(controls),
    }, indent=2))


if __name__ == "__main__":
    main()
