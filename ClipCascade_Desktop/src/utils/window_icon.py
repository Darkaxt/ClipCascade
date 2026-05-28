from PIL import Image, ImageDraw, ImageTk


def create_clipboard_icon():
    """Create the clipboard artwork used by the tray and Tk windows."""
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


def apply_clipboard_window_icon(window):
    """Apply the shared clipboard artwork to a Tk window/taskbar entry."""
    photo = ImageTk.PhotoImage(create_clipboard_icon())
    window.iconphoto(True, photo)
    window._clipcascade_window_icon = photo
