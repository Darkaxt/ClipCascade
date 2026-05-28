import sys
import unittest
from pathlib import Path


SRC_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SRC_DIR))

from utils.window_icon import create_clipboard_icon  # noqa: E402


class WindowIconTest(unittest.TestCase):
    def test_clipboard_icon_matches_tray_asset_size_and_mode(self):
        icon = create_clipboard_icon()

        self.assertEqual(icon.size, (64, 64))
        self.assertEqual(icon.mode, "RGBA")


if __name__ == "__main__":
    unittest.main()
