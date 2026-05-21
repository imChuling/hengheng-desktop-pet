#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "stickers" / "lcl1-jimmy-band"
SIZE = 512
SCENE = (1024, 768)
SHEET_SIZE = (900, 1800)


def trim_alpha(image: Image.Image, padding: int = 8) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    return image.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(image.width, right + padding),
            min(image.height, bottom + padding),
        )
    )


def fit(image: Image.Image, size: int = SIZE, margin: int = 46) -> Image.Image:
    image = trim_alpha(image)
    scale = min((size - margin * 2) / image.width, (size - margin * 2) / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return canvas


def outline(image: Image.Image, px: int = 18) -> Image.Image:
    alpha = image.getchannel("A")
    expanded = alpha.filter(ImageFilter.MaxFilter(px * 2 + 1))
    softened = expanded.filter(ImageFilter.GaussianBlur(1.1))
    outline_alpha = ImageChops.subtract(softened, alpha)
    white = Image.new("RGBA", image.size, (255, 255, 255, 255))
    white.putalpha(outline_alpha)
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    result.alpha_composite(white)
    result.alpha_composite(image)
    return result


def watercolorize(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    soft = image.filter(ImageFilter.GaussianBlur(0.45))
    color = ImageEnhance.Color(soft).enhance(1.08)
    contrast = ImageEnhance.Contrast(color).enhance(0.98)
    alpha = image.getchannel("A")
    contrast.putalpha(alpha)
    return contrast


def source(name: str) -> Image.Image:
    return Image.open(ROOT / "assets" / "characters" / name / "icon.png").convert("RGBA")


def frame(name: str, state: str = "icon", index: int = 0) -> Image.Image:
    if state == "icon":
        image = source(name)
    else:
        image = Image.open(ROOT / "assets" / "characters" / name / "frames" / state / f"{index:02d}.png").convert("RGBA")
    return image


def character(name: str, height: int, state: str = "icon", index: int = 0) -> Image.Image:
    image = trim_alpha(frame(name, state, index), padding=4)
    scale = height / image.height
    return watercolorize(image.resize((round(image.width * scale), height), Image.LANCZOS))


def headshot(name: str, size: int, state: str = "icon", index: int = 0, crop_ratio: float = 0.58) -> Image.Image:
    image = trim_alpha(frame(name, state, index), padding=3)
    w, h = image.size
    crop = image.crop((0, 0, w, round(h * crop_ratio)))
    scale = size / crop.height
    return watercolorize(crop.resize((round(crop.width * scale), size), Image.LANCZOS))


def paste_bottom(canvas: Image.Image, image: Image.Image, cx: int, bottom: int) -> None:
    canvas.alpha_composite(image, (round(cx - image.width / 2), bottom - image.height))


def music_note(draw: ImageDraw.ImageDraw, x: int, y: int, scale: int, color: tuple[int, int, int, int]) -> None:
    stem_w = max(4, scale // 6)
    draw.ellipse((x, y + scale, x + scale, y + scale * 2), fill=color)
    draw.rounded_rectangle((x + scale - stem_w, y, x + scale + stem_w, y + scale * 3 // 2), radius=stem_w, fill=color)
    draw.polygon(
        [
            (x + scale, y),
            (x + scale * 2, y + scale // 4),
            (x + scale * 2, y + scale // 2),
            (x + scale, y + scale // 3),
        ],
        fill=color,
    )


def star(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, color: tuple[int, int, int, int]) -> None:
    draw.polygon(
        [
            (cx, cy - r),
            (cx + r // 4, cy - r // 4),
            (cx + r, cy),
            (cx + r // 4, cy + r // 4),
            (cx, cy + r),
            (cx - r // 4, cy + r // 4),
            (cx - r, cy),
            (cx - r // 4, cy - r // 4),
        ],
        fill=color,
    )


def draw_keyboard(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int) -> None:
    draw.rounded_rectangle((x, y, x + w, y + h), radius=18, fill=(22, 24, 31, 255))
    draw.rounded_rectangle((x + 10, y + 12, x + w - 10, y + h - 10), radius=12, fill=(248, 247, 241, 255))
    white_keys = 13
    key_w = (w - 20) / white_keys
    for i in range(1, white_keys):
        kx = x + 10 + round(i * key_w)
        draw.line((kx, y + 15, kx, y + h - 12), fill=(210, 207, 199, 255), width=2)
    for i in [1, 2, 4, 5, 6, 8, 9, 11]:
        kx = x + 10 + round(i * key_w - key_w * 0.26)
        draw.rounded_rectangle((kx, y + 12, kx + round(key_w * 0.52), y + h - 34), radius=4, fill=(30, 31, 36, 255))
    draw.rounded_rectangle((x + 22, y + 20, x + 82, y + 38), radius=6, fill=(126, 202, 219, 255))


def draw_guitar(draw: ImageDraw.ImageDraw, x: int, y: int, scale: float = 1.0) -> None:
    s = scale
    draw.line((x + 92 * s, y + 12 * s, x + 20 * s, y + 142 * s), fill=(65, 45, 35, 255), width=max(5, round(8 * s)))
    draw.ellipse((x, y + 110 * s, x + 86 * s, y + 196 * s), fill=(207, 118, 35, 255), outline=(96, 54, 26, 255), width=max(2, round(4 * s)))
    draw.ellipse((x + 36 * s, y + 84 * s, x + 112 * s, y + 160 * s), fill=(231, 153, 54, 255), outline=(96, 54, 26, 255), width=max(2, round(4 * s)))
    draw.ellipse((x + 48 * s, y + 124 * s, x + 70 * s, y + 146 * s), fill=(56, 38, 31, 255))
    draw.rounded_rectangle((x + 84 * s, y, x + 132 * s, y + 26 * s), radius=round(7 * s), fill=(48, 38, 32, 255))


def draw_boba(draw: ImageDraw.ImageDraw, x: int, y: int, scale: float = 1.0) -> None:
    s = scale
    draw.rounded_rectangle((x, y + 24 * s, x + 78 * s, y + 142 * s), radius=round(18 * s), fill=(248, 220, 202, 240), outline=(157, 99, 76, 255), width=max(2, round(3 * s)))
    draw.rectangle((x + 8 * s, y + 56 * s, x + 70 * s, y + 88 * s), fill=(222, 150, 112, 225))
    draw.line((x + 48 * s, y, x + 72 * s, y + 72 * s), fill=(210, 93, 116, 255), width=max(3, round(5 * s)))
    for bx, by in [(18, 108), (34, 122), (50, 106), (60, 128)]:
        draw.ellipse((x + bx * s, y + by * s, x + (bx + 10) * s, y + (by + 10) * s), fill=(68, 45, 36, 255))


def draw_cake(draw: ImageDraw.ImageDraw, x: int, y: int, scale: float = 1.0) -> None:
    s = scale
    draw.polygon([(x, y + 108 * s), (x + 138 * s, y + 64 * s), (x + 118 * s, y + 144 * s)], fill=(249, 222, 177, 255), outline=(185, 126, 80, 255))
    draw.polygon([(x + 14 * s, y + 102 * s), (x + 128 * s, y + 68 * s), (x + 121 * s, y + 94 * s), (x + 24 * s, y + 126 * s)], fill=(244, 126, 93, 230))
    draw.ellipse((x + 96 * s, y + 44 * s, x + 126 * s, y + 74 * s), fill=(226, 64, 72, 255))


def draw_envelope(draw: ImageDraw.ImageDraw, x: int, y: int, w: int = 118, h: int = 78) -> None:
    draw.rounded_rectangle((x, y, x + w, y + h), radius=10, fill=(255, 239, 214, 255), outline=(196, 144, 92, 255), width=3)
    draw.line((x + 6, y + 8, x + w // 2, y + h // 2, x + w - 6, y + 8), fill=(196, 144, 92, 255), width=3)
    draw.line((x + 6, y + h - 6, x + w // 2, y + h // 2, x + w - 6, y + h - 6), fill=(196, 144, 92, 255), width=3)


def draw_label(draw: ImageDraw.ImageDraw, text: str, x: int, y: int, fill: tuple[int, int, int, int]) -> None:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf", 42)
    stroke = (255, 255, 255, 255)
    draw.text((x, y), text, font=font, fill=fill, stroke_width=5, stroke_fill=stroke)


def draw_mic(draw: ImageDraw.ImageDraw, x: int, y: int, scale: int = 1) -> None:
    draw.line((x, y + 50 * scale, x, y + 230 * scale), fill=(34, 35, 42, 255), width=8 * scale)
    draw.line((x - 54 * scale, y + 230 * scale, x + 54 * scale, y + 230 * scale), fill=(34, 35, 42, 255), width=8 * scale)
    draw.line((x - 14 * scale, y + 50 * scale, x + 70 * scale, y + 18 * scale), fill=(34, 35, 42, 255), width=7 * scale)
    draw.ellipse((x + 56 * scale, y - 6 * scale, x + 108 * scale, y + 46 * scale), fill=(44, 46, 55, 255))
    draw.ellipse((x + 66 * scale, y + 4 * scale, x + 98 * scale, y + 36 * scale), fill=(204, 219, 225, 255))


def draw_amp(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int) -> None:
    draw.rounded_rectangle((x, y, x + w, y + h), radius=16, fill=(37, 38, 43, 255))
    draw.rounded_rectangle((x + 12, y + 34, x + w - 12, y + h - 14), radius=10, fill=(74, 72, 70, 255))
    for gx in range(x + 24, x + w - 22, 16):
        draw.line((gx, y + 42, gx, y + h - 22), fill=(119, 115, 108, 180), width=2)
    for gy in range(y + 44, y + h - 22, 16):
        draw.line((x + 24, gy, x + w - 24, gy), fill=(119, 115, 108, 150), width=2)
    for i in range(4):
        draw.ellipse((x + 18 + i * 22, y + 12, x + 30 + i * 22, y + 24), fill=(245, 202, 88, 255))


def frame_sticker(canvas: Image.Image, name: str) -> dict:
    path = OUT / f"{name}.png"
    outline(fit(watercolorize(canvas))).save(path)
    return {"id": name, "displayName": name.replace("-", " "), "file": path.name}


def scene_sticker(canvas: Image.Image, name: str) -> dict:
    path = OUT / f"{name}.png"
    outline(watercolorize(canvas), px=20).save(path)
    return {"id": name, "displayName": name.replace("-", " "), "file": path.name, "type": "group"}


def lcl_keyboard() -> dict:
    c = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(c)
    for x, y, s, color in [(76, 88, 20, (94, 189, 208, 220)), (410, 112, 18, (245, 194, 90, 220)), (112, 390, 16, (234, 92, 132, 210))]:
        music_note(draw, x, y, s, color)
    paste_bottom(c, character("lcl1", 378, "running", 0), 262, 442)
    draw_keyboard(draw, 114, 308, 300, 78)
    return frame_sticker(c, "lcl1-keyboard-solo")


def lcl_vocal() -> dict:
    c = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(c)
    draw_mic(draw, 162, 210)
    paste_bottom(c, character("lcl1", 392, "waving", 2), 280, 450)
    for x, y, r in [(112, 92, 18), (410, 86, 22), (402, 382, 15)]:
        star(draw, x, y, r, (245, 203, 92, 220))
    return frame_sticker(c, "lcl1-lead-vocal")


def jimmy_solo() -> dict:
    c = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(c)
    for x, y, s, color in [(96, 94, 21, (94, 189, 208, 220)), (390, 82, 19, (245, 194, 90, 230)), (418, 354, 17, (234, 92, 132, 210))]:
        music_note(draw, x, y, s, color)
    paste_bottom(c, character("jimmy", 390, "icon", 0), 258, 454)
    return frame_sticker(c, "jimmy-guitar-solo")


def jimmy_amp() -> dict:
    c = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(c)
    draw_amp(draw, 274, 284, 142, 112)
    paste_bottom(c, character("jimmy", 372), 235, 448)
    for x, y, r in [(104, 114, 22), (430, 110, 16)]:
        star(draw, x, y, r, (245, 203, 92, 225))
    return frame_sticker(c, "jimmy-amp-riff")


def duo_duet() -> dict:
    c = Image.new("RGBA", SCENE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(c)
    draw.rounded_rectangle((360, 448, 666, 538), radius=24, fill=(22, 24, 31, 255))
    draw_keyboard(draw, 374, 460, 278, 68)
    draw_mic(draw, 450, 260, scale=1)
    paste_bottom(c, character("lcl1", 472, "waiting", 2), 350, 676)
    paste_bottom(c, character("jimmy", 490, "waving", 1), 690, 684)
    for x, y, s, color in [(148, 116, 34, (94, 189, 208, 220)), (796, 104, 30, (245, 194, 90, 225)), (874, 304, 26, (234, 92, 132, 210))]:
        music_note(draw, x, y, s, color)
    return scene_sticker(c, "lcl1-jimmy-duet")


def stage_finale() -> dict:
    c = Image.new("RGBA", SCENE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(c)
    draw_amp(draw, 742, 484, 168, 130)
    draw_keyboard(draw, 236, 548, 320, 76)
    draw_mic(draw, 402, 342, scale=1)
    paste_bottom(c, character("lcl1", 470, "running", 3), 330, 688)
    paste_bottom(c, character("jimmy", 485, "running", 2), 650, 690)
    for x, y, r in [(180, 118, 28), (510, 86, 24), (870, 138, 26), (116, 376, 20)]:
        star(draw, x, y, r, (245, 203, 92, 225))
    for x, y, s in [(92, 210, 24), (862, 312, 25), (660, 122, 22)]:
        music_note(draw, x, y, s, (94, 189, 208, 215))
    return scene_sticker(c, "band-stage-finale")


def backstage() -> dict:
    c = Image.new("RGBA", SCENE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(c)
    draw_keyboard(draw, 178, 510, 292, 72)
    draw_amp(draw, 702, 484, 164, 126)
    paste_bottom(c, character("lcl1", 470, "idle", 4), 332, 678)
    paste_bottom(c, character("jimmy", 470, "waiting", 4), 666, 680)
    for x, y, r, color in [
        (162, 160, 24, (234, 92, 132, 210)),
        (482, 104, 24, (245, 203, 92, 225)),
        (838, 182, 22, (94, 189, 208, 215)),
    ]:
        star(draw, x, y, r, color)
    return scene_sticker(c, "band-backstage-ready")


def tiny_band() -> dict:
    c = Image.new("RGBA", SCENE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(c)
    draw_keyboard(draw, 252, 556, 250, 58)
    paste_bottom(c, character("lcl1", 410, "jumping", 2), 332, 668)
    paste_bottom(c, character("jimmy", 425, "jumping", 2), 632, 672)
    for x, y, s in [(166, 164, 26), (806, 160, 26), (498, 94, 22)]:
        music_note(draw, x, y, s, (245, 194, 90, 220))
    return scene_sticker(c, "tiny-band-groove")


def lcl_pose(state: str, index: int, name: str) -> dict:
    c = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(c)
    paste_bottom(c, character("lcl1", 390, state, index), 258, 452)
    for x, y, r in [(78, 94, 17), (418, 126, 15)]:
        star(draw, x, y, r, (245, 203, 92, 220))
    return frame_sticker(c, name)


def jimmy_pose(state: str, index: int, name: str) -> dict:
    c = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(c)
    if name == "jimmy-no-instrument":
        base = trim_alpha(frame("jimmy", "idle", 2), padding=3)
        w, h = base.size
        bust = base.crop((0, 0, round(w * 0.72), round(h * 0.48)))
        scale = 330 / bust.height
        bust = watercolorize(bust.resize((round(bust.width * scale), 330), Image.LANCZOS))
        c.alpha_composite(bust, (round((SIZE - bust.width) / 2), 104))
        draw_heart(draw, 350, 110, 42, (94, 189, 208, 210))
    else:
        paste_bottom(c, character("jimmy", 385, state, index), 258, 452)
    for x, y, r in [(96, 88, 18), (410, 130, 16)]:
        star(draw, x, y, r, (94, 189, 208, 215))
    return frame_sticker(c, name)


def head_sticker(name: str, who: str, state: str, index: int, heart_color: tuple[int, int, int, int]) -> dict:
    c = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(c)
    c.alpha_composite(headshot(who, 310, state, index), (118, 118))
    draw_heart(draw, 348, 120, 46, heart_color)
    return frame_sticker(c, name)


def draw_heart(draw: ImageDraw.ImageDraw, x: int, y: int, size: int, color: tuple[int, int, int, int]) -> None:
    r = size // 4
    draw.ellipse((x, y, x + 2 * r, y + 2 * r), fill=color)
    draw.ellipse((x + 2 * r, y, x + 4 * r, y + 2 * r), fill=color)
    draw.polygon([(x, y + r), (x + 4 * r, y + r), (x + 2 * r, y + size)], fill=color)


def prop_sticker(name: str, kind: str) -> dict:
    c = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(c)
    if kind == "keyboard":
        draw_keyboard(draw, 92, 220, 330, 92)
        for x, y, s in [(96, 96, 25), (392, 112, 23)]:
            music_note(draw, x, y, s, (94, 189, 208, 220))
    elif kind == "guitar":
        draw_guitar(draw, 188, 130, 1.25)
        star(draw, 120, 116, 22, (245, 203, 92, 225))
        music_note(draw, 380, 142, 24, (234, 92, 132, 210))
    elif kind == "snacks":
        draw_boba(draw, 100, 176, 1.35)
        draw_cake(draw, 260, 194, 1.05)
        draw_heart(draw, 206, 110, 40, (234, 92, 132, 210))
    elif kind == "letter":
        draw_envelope(draw, 120, 190, 260, 160)
        draw_heart(draw, 232, 226, 54, (234, 92, 132, 215))
    return frame_sticker(c, name)


def make_sheet(entries: list[dict]) -> None:
    sheet = Image.new("RGBA", SHEET_SIZE, (0, 0, 0, 0))
    placements = [
        ("lcl1-lead-vocal", 34, 42, 245),
        ("prop-love-letter", 260, 34, 132),
        ("lcl1-jimmy-duet", 420, 24, 430),
        ("prop-snacks", 690, 202, 160),
        ("jimmy-guitar-solo", 610, 350, 244),
        ("lcl1-keyboard-solo", 70, 330, 310),
        ("band-stage-finale", 270, 500, 390),
        ("prop-keyboard", 700, 540, 150),
        ("lcl1-happy-head", 60, 720, 148),
        ("jimmy-happy-head", 230, 724, 148),
        ("lcl1-no-instrument", 405, 760, 196),
        ("jimmy-no-instrument", 630, 760, 190),
        ("band-backstage-ready", 52, 980, 340),
        ("tiny-band-groove", 458, 1010, 330),
        ("lcl1-running-keys", 44, 1325, 230),
        ("jimmy-amp-riff", 288, 1322, 225),
        ("prop-guitar", 548, 1330, 150),
        ("prop-snacks", 710, 1340, 130),
        ("lcl1-cute-head", 80, 1570, 128),
        ("jimmy-cute-head", 240, 1570, 128),
        ("prop-love-letter", 400, 1582, 128),
        ("prop-keyboard", 560, 1580, 128),
        ("prop-guitar", 715, 1570, 126),
    ]
    lookup = {entry["id"]: entry for entry in entries}
    for entry_id, x, y, box in placements:
        entry = lookup[entry_id]
        image = Image.open(OUT / entry["file"]).convert("RGBA")
        image.thumbnail((box, box), Image.LANCZOS)
        sheet.alpha_composite(image, (x, y))
    draw = ImageDraw.Draw(sheet)
    for x, y, r, color in [
        (32, 308, 18, (245, 203, 92, 220)),
        (242, 302, 14, (234, 92, 132, 190)),
        (812, 88, 16, (245, 203, 92, 220)),
        (768, 692, 18, (234, 92, 132, 185)),
        (40, 934, 14, (94, 189, 208, 190)),
        (826, 960, 18, (245, 203, 92, 220)),
        (72, 1292, 14, (234, 92, 132, 190)),
        (850, 1518, 16, (245, 203, 92, 220)),
    ]:
        star(draw, x, y, r, color)
    for x, y, s, color in [
        (330, 206, 20, (234, 92, 132, 190)),
        (808, 318, 22, (94, 189, 208, 200)),
        (170, 936, 20, (245, 194, 90, 210)),
        (778, 1238, 18, (234, 92, 132, 190)),
    ]:
        music_note(draw, x, y, s, color)
    draw_label(draw, "Love", 28, 18, (230, 93, 109, 255))
    draw_label(draw, "OK!", 724, 22, (231, 143, 58, 255))
    draw_label(draw, "Band!", 370, 1690, (80, 153, 189, 255))
    sheet.save(OUT / "sticker-sheet.png")
    sheet.save(OUT / "watercolor-sticker-sheet-transparent.png")
    preview = Image.new("RGBA", sheet.size, (255, 255, 255, 255))
    preview.alpha_composite(sheet)
    preview.save(OUT / "sticker-sheet-preview.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    entries = [
        lcl_keyboard(),
        lcl_vocal(),
        jimmy_solo(),
        jimmy_amp(),
        duo_duet(),
        stage_finale(),
        backstage(),
        tiny_band(),
        lcl_pose("idle", 4, "lcl1-no-instrument"),
        jimmy_pose("waving", 2, "jimmy-no-instrument"),
        lcl_pose("running", 0, "lcl1-running-keys"),
        head_sticker("lcl1-happy-head", "lcl1", "waving", 2, (234, 92, 132, 210)),
        head_sticker("lcl1-cute-head", "lcl1", "idle", 2, (245, 203, 92, 210)),
        head_sticker("jimmy-happy-head", "jimmy", "waving", 1, (94, 189, 208, 210)),
        head_sticker("jimmy-cute-head", "jimmy", "idle", 2, (234, 92, 132, 210)),
        prop_sticker("prop-keyboard", "keyboard"),
        prop_sticker("prop-guitar", "guitar"),
        prop_sticker("prop-snacks", "snacks"),
        prop_sticker("prop-love-letter", "letter"),
    ]
    make_sheet(entries)
    manifest = {
        "id": "lcl1-jimmy-band",
        "name": "lcl1 and Jimmy band sticker pack",
        "style": "transparent PNG stickers with white outline, based on Codex pet lcl1 and Jimmy",
        "sheet": "sticker-sheet.png",
        "transparentSheet": "watercolor-sticker-sheet-transparent.png",
        "preview": "sticker-sheet-preview.png",
        "stickers": entries,
    }
    (OUT / "stickers.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(OUT)


if __name__ == "__main__":
    main()
