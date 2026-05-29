import sys
import unittest
import inspect
import importlib.util
from pathlib import Path


SRC_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SRC_DIR))

from PIL import Image  # noqa: E402
from utils.window_icon import (  # noqa: E402
    WINDOWS_APP_USER_MODEL_ID,
    create_clipboard_icon,
    create_window_icon,
    get_clipboard_window_icon_ico_path,
    get_window_icon_ico_path,
    get_window_icon_image_path,
    set_windows_app_user_model_id,
)


def iter_image_pixels(image):
    if hasattr(image, "get_flattened_data"):
        return image.get_flattened_data()
    return image.getdata()


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

    def test_window_icon_ico_matches_tray_artwork(self):
        ico_path = Path(get_clipboard_window_icon_ico_path())

        self.assertTrue(ico_path.is_file())
        self.assertEqual(ico_path.suffix, ".ico")

        with Image.open(ico_path) as icon:
            self.assertEqual(icon.mode, "RGBA")
            self.assertIn(icon.size[0], {16, 32, 48, 64})

    def test_tray_icon_keeps_transparent_generated_clipboard_artwork(self):
        icon = create_clipboard_icon()
        self.assertEqual(icon.size, (64, 64))
        self.assertEqual(icon.getpixel((0, 0))[3], 0)
        self.assertIsNotNone(icon.getchannel("A").getbbox())
        cyan_pixels = sum(
            1
            for r, g, b, a in iter_image_pixels(icon)
            if a and r < 80 and g > 140 and b > 170
        )
        self.assertEqual(cyan_pixels, 0)

    def test_window_icon_uses_packaged_cyan_app_artwork(self):
        image_path = Path(get_window_icon_image_path())
        ico_path = Path(get_window_icon_ico_path())

        self.assertEqual(image_path.name, "window-icon.png")
        self.assertEqual(ico_path.name, "window-icon.ico")
        self.assertTrue(image_path.is_file())
        self.assertTrue(ico_path.is_file())

        icon = create_window_icon()
        self.assertEqual(icon.size, (64, 64))
        self.assertEqual(icon.mode, "RGBA")
        cyan_pixels = sum(
            1
            for r, g, b, a in iter_image_pixels(icon)
            if a and r < 80 and g > 140 and b > 170
        )
        self.assertGreater(cyan_pixels, 50)

    def test_windows_app_user_model_id_is_stable(self):
        self.assertEqual(WINDOWS_APP_USER_MODEL_ID, "Darkaxt.ClipCascade")
        set_windows_app_user_model_id()

    def test_visible_tk_windows_apply_shared_window_icon(self):
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
