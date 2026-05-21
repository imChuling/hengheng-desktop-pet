#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


CELL_WIDTH = 192
CELL_HEIGHT = 208
ATLAS_COLUMNS = 8
STICKER_SIZE = 512
OUTLINE_PX = 20
SCENE_WIDTH = 1024
SCENE_HEIGHT = 768


@dataclass(frozen=True)
class PetSticker:
    pet_id: str
    display_name: str
    sheet: Path
    row: int = 0
    col: int = 0


def trim_alpha(image: Image.Image, padding: int = 6) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def fit_on_canvas(image: Image.Image, size: int = STICKER_SIZE, margin: int = 44) -> Image.Image:
    image = trim_alpha(image)
    available = size - margin * 2
    scale = min(available / image.width, available / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - resized.width) // 2
    y = (size - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def add_sticker_outline(image: Image.Image, outline_px: int = OUTLINE_PX) -> Image.Image:
    alpha = image.getchannel("A")
    expanded = alpha.filter(ImageFilter.MaxFilter(outline_px * 2 + 1))
    softened = expanded.filter(ImageFilter.GaussianBlur(1.2))
    outline_alpha = ImageChops.subtract(softened, alpha)
    outline = Image.new("RGBA", image.size, (255, 255, 255, 255))
    outline.putalpha(outline_alpha)
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    result.alpha_composite(outline)
    result.alpha_composite(image)
    return result


def extract_cell(sheet_path: Path, row: int, col: int) -> Image.Image:
    sheet = Image.open(sheet_path).convert("RGBA")
    x = col * CELL_WIDTH
    y = row * CELL_HEIGHT
    return sheet.crop((x, y, x + CELL_WIDTH, y + CELL_HEIGHT))


def chroma_to_alpha(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            is_magenta = r > 170 and b > 150 and g < 165
            is_cyan = g > 155 and b > 155 and r < 145
            is_black_bg = r < 8 and g < 8 and b < 8
            is_low_alpha_fringe = a < 190 and (is_magenta or is_cyan)
            if is_magenta or is_black_bg or is_low_alpha_fringe:
                pixels[x, y] = (0, 0, 0, 0)
            elif a:
                pixels[x, y] = (r, g, b, 255)
    return image


def make_cutout(image: Image.Image, target_height: int = 430) -> Image.Image:
    cutout = trim_alpha(chroma_to_alpha(image), padding=4)
    scale = target_height / cutout.height
    return cutout.resize((round(cutout.width * scale), round(cutout.height * scale)), Image.LANCZOS)


def sticker_from_source(image: Image.Image, size: int = STICKER_SIZE) -> Image.Image:
    return add_sticker_outline(fit_on_canvas(chroma_to_alpha(image), size=size))


def draw_heart(draw: ImageDraw.ImageDraw, x: int, y: int, size: int, color: tuple[int, int, int, int]) -> None:
    r = size // 4
    draw.ellipse((x, y, x + 2 * r, y + 2 * r), fill=color)
    draw.ellipse((x + 2 * r, y, x + 4 * r, y + 2 * r), fill=color)
    draw.polygon([(x - 1, y + r), (x + 4 * r + 1, y + r), (x + 2 * r, y + size)], fill=color)


def draw_star(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int, color: tuple[int, int, int, int]) -> None:
    points = [
        (cx, cy - radius),
        (cx + radius // 4, cy - radius // 4),
        (cx + radius, cy),
        (cx + radius // 4, cy + radius // 4),
        (cx, cy + radius),
        (cx - radius // 4, cy + radius // 4),
        (cx - radius, cy),
        (cx - radius // 4, cy - radius // 4),
    ]
    draw.polygon(points, fill=color)


def decorate(canvas: Image.Image, theme: str) -> None:
    draw = ImageDraw.Draw(canvas)
    if theme == "hearts":
        draw_heart(draw, 70, 72, 44, (255, 166, 194, 210))
        draw_heart(draw, canvas.width - 145, 102, 34, (255, 203, 219, 230))
        draw_heart(draw, canvas.width // 2 - 22, 42, 32, (255, 128, 169, 200))
    elif theme == "stars":
        for x, y, r in [(78, 100, 22), (180, 58, 14), (canvas.width - 124, 86, 24), (canvas.width - 210, 150, 13)]:
            draw_star(draw, x, y, r, (255, 218, 92, 220))
    elif theme == "bubbles":
        for x, y, r, c in [
            (96, 116, 24, (166, 221, 255, 185)),
            (canvas.width - 130, 96, 30, (222, 196, 255, 175)),
            (canvas.width // 2, 68, 18, (255, 226, 143, 180)),
        ]:
            draw.ellipse((x - r, y - r, x + r, y + r), fill=c)
    elif theme == "sparkle":
        for x, y, r in [(95, 92, 20), (canvas.width - 92, 112, 19), (canvas.width // 2, 54, 15)]:
            draw_star(draw, x, y, r, (255, 236, 122, 225))
        draw_heart(draw, canvas.width // 2 + 50, 66, 28, (255, 163, 192, 210))


def paste_center_bottom(canvas: Image.Image, sprite: Image.Image, center_x: int, bottom_y: int) -> None:
    canvas.alpha_composite(sprite, (round(center_x - sprite.width / 2), bottom_y - sprite.height))


def make_scene(
    members: list[tuple[str, Image.Image, int, int, int]],
    output: Path,
    theme: str,
    size: tuple[int, int] = (SCENE_WIDTH, SCENE_HEIGHT),
) -> dict:
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    decorate(canvas, theme)
    for _name, image, center_x, bottom_y, height in members:
        paste_center_bottom(canvas, make_cutout(image, target_height=height), center_x, bottom_y)
    add_sticker_outline(canvas, outline_px=18).save(output)
    return {"id": output.stem, "displayName": output.stem.replace("-", " "), "file": output.name, "type": "group"}


def save_pet_sticker(sticker: PetSticker, output_dir: Path, raw_sources: dict[str, Image.Image]) -> dict:
    source = extract_cell(sticker.sheet, sticker.row, sticker.col)
    raw_sources[sticker.pet_id] = source
    output = output_dir / f"{sticker.pet_id}.png"
    sticker_from_source(source).save(output)
    return {
        "id": sticker.pet_id,
        "displayName": sticker.display_name,
        "source": str(sticker.sheet),
        "file": output.name,
    }


def save_zyr2_sticker(source_path: Path, output_dir: Path, raw_sources: dict[str, Image.Image]) -> dict:
    source = chroma_to_alpha(Image.open(source_path))
    raw_sources["zyr2"] = source
    output = output_dir / "zyr2.png"
    sticker_from_source(source).save(output)
    return {
        "id": "zyr2",
        "displayName": "zyr2",
        "source": str(source_path),
        "file": output.name,
    }


def make_sheet(entries: list[dict], output_dir: Path) -> Path:
    cols = 4
    rows = (len(entries) + cols - 1) // cols
    gap = 28
    cell = 360
    sheet = Image.new("RGBA", (cols * cell + (cols + 1) * gap, rows * cell + (rows + 1) * gap), (0, 0, 0, 0))
    for index, entry in enumerate(entries):
        image = Image.open(output_dir / entry["file"]).convert("RGBA")
        image.thumbnail((cell, cell), Image.LANCZOS)
        x = gap + (index % cols) * (cell + gap)
        y = gap + (index // cols) * (cell + gap)
        sheet.alpha_composite(image, (x + (cell - image.width) // 2, y + (cell - image.height) // 2))
    output = output_dir / "sticker-sheet.png"
    sheet.save(output)
    preview = Image.new("RGBA", sheet.size, (255, 244, 250, 255))
    preview.alpha_composite(sheet)
    preview.save(output_dir / "sticker-sheet-preview.png")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a six-character sticker pack from existing pet sprites.")
    parser.add_argument("--output-dir", type=Path, default=Path("desktop-pet/assets/stickers/friends"))
    parser.add_argument("--zyr2-source", type=Path)
    args = parser.parse_args()

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    pets_root = Path.home() / ".codex" / "pets"
    stickers = [
        PetSticker("lcl1", "小lcl", pets_root / "lcl1" / "spritesheet.webp"),
        PetSticker("lcl2", "小lcl2", pets_root / "lcl2" / "spritesheet.webp"),
        PetSticker("xf1", "xf1", pets_root / "xf1" / "spritesheet.webp"),
        PetSticker("xf2", "xf2", pets_root / "xf2" / "spritesheet.webp"),
        PetSticker("zyr1", "小zyr", pets_root / "zyr1" / "spritesheet.webp"),
    ]

    raw_sources: dict[str, Image.Image] = {}
    entries = [save_pet_sticker(sticker, output_dir, raw_sources) for sticker in stickers]

    if args.zyr2_source:
        entries.append(save_zyr2_sticker(args.zyr2_source, output_dir, raw_sources))
    else:
        entries.append({
            "id": "zyr2",
            "displayName": "zyr2",
            "source": None,
            "file": None,
            "status": "waiting-for-source-image",
        })

    if "zyr2" in raw_sources:
        scene_specs = [
            (
                "three-friends-hearts.png",
                "hearts",
                [("lcl", raw_sources["lcl2"], 260, 690, 490), ("zyr", raw_sources["zyr1"], 520, 690, 510), ("xf", raw_sources["xf1"], 760, 690, 485)],
            ),
            (
                "pajama-party.png",
                "bubbles",
                [("lcl", raw_sources["lcl1"], 260, 690, 455), ("xf", raw_sources["xf2"], 505, 690, 455), ("zyr", raw_sources["zyr2"], 760, 690, 500)],
            ),
            (
                "bestie-sparkles.png",
                "sparkle",
                [("lcl", raw_sources["lcl2"], 330, 690, 500), ("zyr", raw_sources["zyr2"], 690, 690, 510)],
            ),
            (
                "cute-team.png",
                "stars",
                [("xf", raw_sources["xf2"], 335, 690, 500), ("zyr", raw_sources["zyr1"], 690, 690, 510)],
            ),
            (
                "dress-up-day.png",
                "hearts",
                [("lcl", raw_sources["lcl1"], 315, 690, 505), ("xf", raw_sources["xf1"], 690, 690, 500)],
            ),
            (
                "all-six-together.png",
                "sparkle",
                [
                    ("lcl1", raw_sources["lcl1"], 150, 700, 330),
                    ("lcl2", raw_sources["lcl2"], 300, 700, 340),
                    ("xf1", raw_sources["xf1"], 455, 700, 335),
                    ("xf2", raw_sources["xf2"], 605, 700, 335),
                    ("zyr1", raw_sources["zyr1"], 760, 700, 345),
                    ("zyr2", raw_sources["zyr2"], 905, 700, 345),
                ],
            ),
        ]
        for filename, theme, members in scene_specs:
            entries.append(make_scene(members, output_dir / filename, theme))

    sheet_path = make_sheet([entry for entry in entries if entry.get("file")], output_dir)
    manifest = {
        "id": "friends",
        "name": "Friends sticker pack",
        "style": "transparent PNG stickers with white outline",
        "sheet": sheet_path.name,
        "preview": "sticker-sheet-preview.png",
        "stickers": entries,
    }
    (output_dir / "stickers.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(output_dir)


if __name__ == "__main__":
    main()
