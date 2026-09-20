#!/usr/bin/env python3
"""
============================================================================
Kumar Video & Photography - Content Management Utility (Python)
============================================================================

Usage:
  python scripts/manage_content.py validate    -> Checks that all images/videos exist
  python scripts/manage_content.py list        -> Lists all current portfolio items
  python scripts/manage_content.py help        -> Displays instructions
"""

import json
import os
import sys

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CONTENT_FILE = os.path.join(ROOT_DIR, "content.json")


def load_content():
    if not os.path.exists(CONTENT_FILE):
        print(f"Error: Could not find {CONTENT_FILE}")
        sys.exit(1)
    with open(CONTENT_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def validate():
    print("\n--- Validating content.json against physical disk files ---")
    data = load_content()
    errors = 0
    total_photos = 0
    total_videos = 0

    # Validate gallery photos
    for category, photos in data.get("gallery", {}).items():
        for idx, photo in enumerate(photos):
            total_photos += 1
            rel_path = photo.get("src", "").replace("/", os.sep)
            full_path = os.path.join(ROOT_DIR, rel_path)
            if not os.path.exists(full_path):
                print(f"[MISSING PHOTO] Category: {category} | Entry #{idx+1} ({photo.get('caption') or photo.get('title')}) -> File not found: {photo.get('src')}")
                errors += 1

    # Validate films
    for category, films in data.get("films", {}).items():
        for idx, film in enumerate(films):
            total_videos += 1
            src = film.get("src", "")
            if src and not src.endswith("/"):
                rel_src = src.replace("/", os.sep)
                full_src = os.path.join(ROOT_DIR, rel_src)
                if not os.path.exists(full_src):
                    print(f"[MISSING VIDEO] Category: {category} | Entry #{idx+1} ({film.get('title')}) -> File not found: {src}")
                    errors += 1
            
            poster = film.get("poster", "")
            if poster:
                rel_poster = poster.replace("/", os.sep)
                full_poster = os.path.join(ROOT_DIR, rel_poster)
                if not os.path.exists(full_poster):
                    print(f"[MISSING POSTER] Category: {category} | Entry #{idx+1} ({film.get('title')}) -> Poster not found: {poster}")
                    errors += 1

    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    print(f"\nChecked {total_photos} photos and {total_videos} films.")
    if errors == 0:
        print("[SUCCESS] All media file references are valid and exist on disk!\n")
    else:
        print(f"[WARNING] Found {errors} missing file reference(s). Please check paths in content.json.\n")


def list_items():
    print("\n--- Current Portfolio Items in content.json ---\n")
    data = load_content()

    print("[PHOTOS]:")
    for cat, photos in data.get("gallery", {}).items():
        print(f"  [{cat.upper()}] ({len(photos)} photos)")
        for p in photos:
            print(f"    * {p.get('title') or p.get('caption')} ({p.get('couple') or 'N/A'}) - {p.get('src')}")

    print("\n[FILMS]:")
    for cat, films in data.get("films", {}).items():
        print(f"  [{cat.upper()}] ({len(films)} films)")
        for f in films:
            print(f"    * {f.get('title')} ({f.get('couple') or 'N/A'}) [{f.get('tag') or 'Film'}] - {f.get('src') or 'Coming Soon'}")
    print("")


def show_help():
    print("""
Kumar Video & Photography - Content Management Utility

Commands:
  python scripts/manage_content.py validate   Verifies all image and video paths exist
  python scripts/manage_content.py list       Lists all portfolio items by category
  python scripts/manage_content.py help       Shows this help guide

How to Add a Photo:
  1. Optimize photo as .webp (1000px-2000px wide, ~150-250 KB).
  2. Place file in: gallery/pre-wedding/, gallery/wedding/, or gallery/birthdays/
  3. Open content.json, add an item to the appropriate category array:
     {
       "id": "wed-05",
       "couple": "Anil & Sunita",
       "title": "Baraat Entrance",
       "caption": "Baraat Entrance",
       "location": "Bengaluru",
       "year": "2026",
       "src": "gallery/wedding/baraat-01.webp",
       "published": true
     }
  4. Run "python scripts/manage_content.py validate" to verify.
  5. Commit and push to GitHub.

How to Add a Film / Video:
  1. Compress .mp4 to web resolution (720p or 1080p, H.264 FastStart, under 10 MB).
  2. Place file in: videos/pre-wedding/, videos/wedding/, or videos/birthdays/
  3. Save a poster frame in gallery/<category>/
  4. In content.json under "films", add:
     {
       "id": "film-wed-02",
       "couple": "Anil & Sunita",
       "title": "The Grand Baraat",
       "location": "Bengaluru",
       "src": "videos/wedding/baraat-reel.mp4",
       "poster": "gallery/wedding/baraat-01.webp",
       "tag": "Short Reel",
       "orientation": "portrait",
       "published": true
     }
  5. Commit and push to GitHub.
""")


if __name__ == "__main__":
    cmd = sys.argv[1].lower() if len(sys.argv) > 1 else "validate"
    if cmd == "validate":
        validate()
    elif cmd == "list":
        list_items()
    else:
        show_help()
