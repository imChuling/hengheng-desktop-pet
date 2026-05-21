#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from extract_codex_pet_frames import write_manifest


PROJECT_ROOT = Path(__file__).resolve().parents[1]
CHARACTERS_ROOT = PROJECT_ROOT / "assets" / "characters"


def main() -> None:
    for character_dir in sorted(CHARACTERS_ROOT.iterdir()):
        if not character_dir.is_dir() or character_dir.name.startswith("."):
            continue

        frames_dir = character_dir / "frames"
        if not frames_dir.is_dir():
            continue

        write_manifest(character_dir, character_dir.name)
        print(f"Wrote {character_dir / 'manifest.json'}")


if __name__ == "__main__":
    main()
