#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from extract_codex_pet_frames import export_frames, validate_spritesheet, write_manifest


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CHARACTERS_ROOT = PROJECT_ROOT / "assets" / "characters"
SUPPORTED_SPRITESHEET_NAMES = ("spritesheet.webp", "spritesheet.png")


def resolve_spritesheet(source: Path) -> Path | None:
    if source.is_file():
        return source

    for filename in SUPPORTED_SPRITESHEET_NAMES:
        candidate = source / filename
        if candidate.exists():
            return candidate

    return None


def validate_character_id(character_id: str) -> None:
    if not character_id:
        raise ValueError("Character id cannot be empty.")

    allowed = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")
    invalid = sorted(set(character_id) - allowed)
    if invalid:
        raise ValueError(
            f"Character id can only contain letters, numbers, '-' and '_'. Invalid: {''.join(invalid)}"
        )

    if character_id.startswith("."):
        raise ValueError("Character id cannot start with '.'.")


def copy_character_folder(source: Path, output_dir: Path) -> None:
    frames_dir = source / "frames"
    if not frames_dir.is_dir():
        raise ValueError("Source folder must contain either spritesheet.webp or a frames/ directory.")

    shutil.copytree(frames_dir, output_dir / "frames")

    icon_path = source / "icon.png"
    if icon_path.exists():
        shutil.copy2(icon_path, output_dir / "icon.png")


def import_character(
    source: Path,
    characters_root: Path,
    character_id: str,
    display_name: str | None,
    overwrite: bool
) -> Path:
    validate_character_id(character_id)

    output_dir = characters_root / character_id
    spritesheet = resolve_spritesheet(source)
    if spritesheet:
        validate_spritesheet(spritesheet)

    if output_dir.exists():
        if not overwrite:
            raise FileExistsError(f"Character already exists: {output_dir}. Use --force to overwrite it.")
        shutil.rmtree(output_dir)

    output_dir.mkdir(parents=True, exist_ok=True)

    if spritesheet:
        export_frames(spritesheet, output_dir, character_id, display_name)
    else:
        copy_character_folder(source, output_dir)
        write_manifest(output_dir, character_id, display_name)

    return output_dir


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import a Codex pet spritesheet or character folder into this desktop-pet app."
    )
    parser.add_argument("source", help="Path to a Codex pet folder, spritesheet.webp, or compatible character folder.")
    parser.add_argument("--id", required=True, help="Character id used as the assets/characters folder name.")
    parser.add_argument("--name", help="Display name stored in manifest.json. Defaults to --id.")
    parser.add_argument("--characters-root", default=str(DEFAULT_CHARACTERS_ROOT), help="Destination characters root.")
    parser.add_argument("--force", action="store_true", help="Overwrite an existing character with the same id.")
    args = parser.parse_args()

    try:
        output_dir = import_character(
            source=Path(args.source).expanduser().resolve(),
            characters_root=Path(args.characters_root).expanduser().resolve(),
            character_id=args.id,
            display_name=args.name,
            overwrite=args.force
        )
    except Exception as error:
        print(f"Import failed: {error}", file=sys.stderr)
        return 1

    print(f"Imported character: {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
