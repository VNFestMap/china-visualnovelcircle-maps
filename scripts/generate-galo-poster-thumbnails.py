from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def generate_thumbnail(source: Path, target: Path, force: bool) -> tuple[int, int]:
    if not force and target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        return 0, target.stat().st_size

    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((800, 500), Image.Resampling.LANCZOS)
        image.save(target, "WEBP", quality=78, method=6)
    return 1, target.stat().st_size


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate cached WebP thumbnails for GALO poster cards.")
    parser.add_argument("--force", action="store_true", help="Rebuild thumbnails even when current.")
    parser.add_argument(
        "--uploads",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "uploads" / "galonly",
        help="Path to the GalOnly upload root.",
    )
    args = parser.parse_args()

    source_bytes = 0
    thumbnail_bytes = 0
    generated = 0
    scanned = 0
    for source in args.uploads.rglob("*"):
        if not source.is_file() or source.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        if "thumbs" in source.parts:
            continue
        scanned += 1
        source_bytes += source.stat().st_size
        target = source.parent / "thumbs" / f"{source.stem}.webp"
        changed, size = generate_thumbnail(source, target, args.force)
        generated += changed
        thumbnail_bytes += size

    ratio = (thumbnail_bytes / source_bytes * 100) if source_bytes else 0
    print(
        f"scanned={scanned} generated={generated} "
        f"source_mb={source_bytes / 1048576:.1f} thumbnail_mb={thumbnail_bytes / 1048576:.1f} "
        f"ratio={ratio:.1f}%"
    )


if __name__ == "__main__":
    main()
