import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageTk


_WINDOW_ICON_ICO_PATH = None
WINDOWS_APP_USER_MODEL_ID = "Darkaxt.ClipCascade"


def set_windows_app_user_model_id():
    """Give Windows taskbar grouping an app identity instead of python.exe."""
    if sys.platform != "win32":
        return

    try:
        import ctypes

        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(
            WINDOWS_APP_USER_MODEL_ID
        )
    except Exception:
        pass


def _resource_base_dir():
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parents[3]


def _asset_path(*parts):
    return _resource_base_dir().joinpath(*parts)


def create_clipboard_icon():
    """Create the generated clipboard artwork used by the tray."""
    width, height = 64, 64
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    fill_color = (220, 220, 220)
    outline_color = (255, 255, 255)

    board_coords = (12, 12, 52, 57)
    try:
        draw.rounded_rectangle(
            board_coords, radius=5, fill=None, outline=outline_color, width=3
        )
    except (AttributeError, TypeError):
        draw.rectangle(board_coords, fill=None, outline=outline_color)

    clip_coords = (22, 7, 42, 17)
    try:
        draw.rounded_rectangle(
            clip_coords, radius=3, fill=fill_color, outline=outline_color, width=3
        )
    except (AttributeError, TypeError):
        draw.rectangle(clip_coords, fill=fill_color, outline=outline_color)

    return image


def get_window_icon_image_path():
    """Return the packaged app artwork used for Windows title bars."""
    candidates = [
        _asset_path("logo", "window-icon.png"),
        _asset_path("assets", "window-icon.png"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def create_window_icon():
    """Create the image used by Tk windows without changing the tray icon."""
    icon_path = get_window_icon_image_path()
    if icon_path is not None:
        with Image.open(icon_path) as icon:
            return icon.convert("RGBA").resize((64, 64), Image.Resampling.LANCZOS)

    return create_clipboard_icon()


def create_clipboard_icon_with_dot():
    """Create the tray icon variant with a pending-download badge."""
    image = create_clipboard_icon().copy()
    draw = ImageDraw.Draw(image)
    width, _height = 64, 64

    dot_radius = 8
    dot_center_x = width - dot_radius - 5
    dot_center_y = dot_radius + 5
    dot_bbox = [
        dot_center_x - dot_radius,
        dot_center_y - dot_radius,
        dot_center_x + dot_radius,
        dot_center_y + dot_radius,
    ]
    draw.ellipse(dot_bbox, fill=(0, 128, 255, 255))

    highlight_radius = dot_radius // 2
    highlight_center_x = dot_center_x - highlight_radius // 2
    highlight_center_y = dot_center_y - highlight_radius // 2
    highlight_bbox = [
        highlight_center_x - highlight_radius,
        highlight_center_y - highlight_radius,
        highlight_center_x + highlight_radius,
        highlight_center_y + highlight_radius,
    ]
    draw.ellipse(highlight_bbox, fill=(255, 255, 255, 180))

    return image


def get_clipboard_window_icon_ico_path():
    """Return a temporary Windows ICO file matching the tray artwork."""
    global _WINDOW_ICON_ICO_PATH
    if _WINDOW_ICON_ICO_PATH and Path(_WINDOW_ICON_ICO_PATH).is_file():
        return _WINDOW_ICON_ICO_PATH

    icon_path = Path(tempfile.gettempdir()) / "clipcascade-window-icon.ico"
    create_clipboard_icon().save(
        icon_path,
        format="ICO",
        sizes=[(64, 64), (48, 48), (32, 32), (16, 16)],
    )
    _WINDOW_ICON_ICO_PATH = str(icon_path)
    return _WINDOW_ICON_ICO_PATH


def get_window_icon_ico_path():
    """Return the packaged Windows icon, falling back to the tray artwork."""
    candidates = [
        _asset_path("logo", "window-icon.ico"),
        _asset_path("assets", "window-icon.ico"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return get_clipboard_window_icon_ico_path()


def apply_clipboard_window_icon(window):
    """Apply the app artwork to a Tk window/taskbar entry."""
    set_windows_app_user_model_id()

    if sys.platform == "win32":
        window.iconbitmap(default=get_window_icon_ico_path())

    photo = ImageTk.PhotoImage(create_window_icon())
    window.iconphoto(True, photo)
    window._clipcascade_window_icon = photo
