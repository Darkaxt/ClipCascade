import base64
import io
import sys
import types
import unittest
from pathlib import Path

from PIL import Image


SRC_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SRC_DIR))


def _install_import_stubs():
    xxhash = types.ModuleType("xxhash")
    xxhash.xxh64 = lambda _payload: types.SimpleNamespace(intdigest=lambda: 0)
    sys.modules.setdefault("xxhash", xxhash)

    sys.modules.setdefault(
        "pyperclip",
        types.SimpleNamespace(copy=lambda _payload: None),
    )

    gui = sys.modules.setdefault("gui", types.ModuleType("gui"))
    tray = types.ModuleType("gui.tray")
    tray.TaskbarPanel = object
    gui.tray = tray
    sys.modules.setdefault("gui.tray", tray)


_install_import_stubs()

from clipboard.clipboard_manager import ClipboardManager  # noqa: E402


class ClipboardManagerImageEncodingTest(unittest.TestCase):
    def test_windows_dib_image_payload_is_normalized_to_png(self):
        original = Image.new("RGB", (8, 6), (10, 80, 180))
        dib_buffer = io.BytesIO()
        original.save(dib_buffer, format="DIB")

        dib_image = Image.open(io.BytesIO(dib_buffer.getvalue()))
        self.assertEqual(dib_image.format, "DIB")

        encoded = ClipboardManager.convert_image_to_base64(dib_image)
        payload = base64.b64decode(encoded)

        self.assertEqual(payload[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(ClipboardManager.get_image_size(dib_image), len(payload))

        decoded = Image.open(io.BytesIO(payload))
        decoded.load()
        self.assertEqual(decoded.size, original.size)


if __name__ == "__main__":
    unittest.main()
