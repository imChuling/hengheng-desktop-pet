#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


CELL_WIDTH = 192
CELL_HEIGHT = 208
EXPECTED_COLUMNS = 8
ROW_COUNTS = [
    ("idle", 6),
    ("running-right", 8),
    ("running-left", 8),
    ("waving", 4),
    ("jumping", 5),
    ("failed", 8),
    ("waiting", 6),
    ("running", 6),
    ("review", 6),
]


def build_manifest(character_id: str, display_name: str | None = None) -> dict:
    return {
        "schemaVersion": 1,
        "id": character_id,
        "name": display_name or character_id,
        "source": {
            "type": "codex-pet-spritesheet"
        },
        "frameSize": {
            "width": CELL_WIDTH,
            "height": CELL_HEIGHT
        },
        "states": {
            state: {
                "frameCount": frame_count,
                "frameDurationMs": 85 if state.startswith("running") else 110 if state == "jumping" else 140
            }
            for state, frame_count in ROW_COUNTS
        }
    }


def write_manifest(output_dir: Path, character_id: str, display_name: str | None = None) -> None:
    manifest = build_manifest(character_id, display_name)
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8"
    )


def validate_spritesheet(sheet_path: Path) -> None:
    with Image.open(sheet_path) as sheet:
        expected_width = CELL_WIDTH * EXPECTED_COLUMNS
        expected_height = CELL_HEIGHT * len(ROW_COUNTS)
        if sheet.width < expected_width or sheet.height < expected_height:
            raise ValueError(
                "Spritesheet does not look like a 9-state Codex pet atlas "
                f"({expected_width}x{expected_height} minimum expected)."
            )


def export_frames(sheet_path: Path, output_dir: Path, character_id: str | None = None, display_name: str | None = None) -> None:
    validate_spritesheet(sheet_path)
    sheet = Image.open(sheet_path).convert("RGBA")
    resolved_character_id = character_id or output_dir.name

    for row_index, (state, frame_count) in enumerate(ROW_COUNTS):
        state_dir = output_dir / "frames" / state
        state_dir.mkdir(parents=True, exist_ok=True)

        for column in range(frame_count):
            left = column * CELL_WIDTH
            top = row_index * CELL_HEIGHT
            frame = sheet.crop((left, top, left + CELL_WIDTH, top + CELL_HEIGHT))
            frame.save(state_dir / f"{column:02d}.png")

    icon = sheet.crop((0, 0, CELL_WIDTH, CELL_HEIGHT))
    icon.save(output_dir / "icon.png")
    write_manifest(output_dir, resolved_character_id, display_name)


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract Codex pet atlas frames into desktop-pet character folders.")
    parser.add_argument("--spritesheet", required=True, help="Path to spritesheet.webp")
    parser.add_argument("--output-dir", required=True, help="Character output directory")
    parser.add_argument("--id", help="Character id to write into manifest.json. Defaults to output directory name.")
    parser.add_argument("--name", help="Display name to write into manifest.json. Defaults to id.")
    args = parser.parse_args()

    export_frames(Path(args.spritesheet), Path(args.output_dir), args.id, args.name)


if __name__ == "__main__":
    main()
