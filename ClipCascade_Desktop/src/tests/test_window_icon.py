import sys
import unittest
import inspect
import importlib.util
from pathlib import Path


SRC_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SRC_DIR))

from utils.window_icon import create_clipboard_icon  # noqa: E402


def load_class_from_path(module_name, relative_path, class_name):
    module_path = SRC_DIR / relative_path
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return getattr(module, class_name)


class WindowIconTest(unittest.TestCase):
    def test_clipboard_icon_matches_tray_asset_size_and_mode(self):
        icon = create_clipboard_icon()

        self.assertEqual(icon.size, (64, 64))
        self.assertEqual(icon.mode, "RGBA")

    def test_visible_tk_windows_apply_shared_tray_icon(self):
        ActivityWindow = load_class_from_path(
            "clipcascade_activity_window",
            Path("gui") / "activity.py",
            "ActivityWindow",
        )
        CustomDialog = load_class_from_path(
            "clipcascade_custom_dialog",
            Path("gui") / "info.py",
            "CustomDialog",
        )
        activity_source = inspect.getsource(ActivityWindow.__init__)
        dialog_source = inspect.getsource(CustomDialog._configure_window)

        self.assertIn("apply_clipboard_window_icon(self)", activity_source)
        self.assertIn("apply_clipboard_window_icon(self)", dialog_source)


if __name__ == "__main__":
    unittest.main()
