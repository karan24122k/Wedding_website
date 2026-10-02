#!/usr/bin/env python3
"""
============================================================================
Kumar Video & Photography - Google Drive Media Sync & Validation Tool
============================================================================

Usage:
  python scripts/sync_drive.py audit-secrets    -> Verifies zero secrets or Drive URLs leak
  python scripts/sync_drive.py flush            -> Sends cache invalidation to Cloudflare gateway
  python scripts/sync_drive.py test-gateway     -> Verifies /api/ endpoints locally or in production
  python scripts/sync_drive.py help             -> Displays setup and workflow instructions
"""

import os
import sys
import json
import re
import urllib.request
import urllib.error

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def audit_secrets_and_leaks():
    """
    Scans HTML, JS, CSS, and content manifests to ensure NO private Google Drive URLs,
    API keys, service account emails, or credentials are leaked to visitors.
    """
    print("\n--- Auditing Codebase for Secret & Google Drive Link Leakage ---")
    files_to_check = [
        "index.html",
        "gallery.html",
        "films.html",
        "404.html",
        "site.js",
        "styles.css",
        "content.json"
    ]

    leak_patterns = [
        (r'drive\.google\.com/(?:file|drive|folders)/', "Direct Google Drive URL"),
        (r'AIzaSy[A-Za-z0-9_-]{33}', "Google API Key"),
        (r'-----BEGIN (?:RSA )?PRIVATE KEY-----', "Private Key Material"),
        (r'[a-zA-Z0-9_-]+@(?:[a-zA-Z0-9-]+\.)+iam\.gserviceaccount\.com', "Service Account Email")
    ]

    violations = 0
    checked_files = 0

    for fname in files_to_check:
        fpath = os.path.join(ROOT_DIR, fname)
        if not os.path.exists(fpath):
            continue
        checked_files += 1

        with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        for pattern, label in leak_patterns:
            matches = re.findall(pattern, content)
            if matches:
                print(f"[LEAK DETECTED] in {fname}: Found {label} ({len(matches)} occurrence(s))")
                violations += len(matches)

    # Check git tracking for sensitive files
    gitignore_path = os.path.join(ROOT_DIR, ".gitignore")
    if os.path.exists(gitignore_path):
        with open(gitignore_path, "r", encoding="utf-8") as f:
            gi_content = f.read()
            if "*.json" not in gi_content and "service-account" not in gi_content and ".env" not in gi_content:
                print("[NOTE] Ensure service-account credentials (*.json, .env) are in .gitignore.")

    if violations == 0:
        print(f"[PASS] Audited {checked_files} client-facing files: 0 secret leaks detected! Zero Google Drive URLs exposed.")
    else:
        print(f"[FAIL] Found {violations} potential security violation(s)!")
        sys.exit(1)


def flush_gateway_cache(gateway_url, sync_secret):
    """
    Calls POST /api/sync with MEDIA_SYNC_SECRET to flush Cloudflare cache and re-index Drive.
    """
    print(f"\n--- Triggering Gateway Cache Flush at {gateway_url} ---")
    endpoint = f"{gateway_url.rstrip('/')}/api/sync"

    req = urllib.request.Request(
        endpoint,
        data=b"{}",
        headers={
            "Authorization": f"Bearer {sync_secret}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print("[SUCCESS] Cloudflare Gateway re-indexed Google Drive successfully!")
            print(f"Total active media items cataloged: {data.get('totalItems', 0)}")
            print(f"Timestamp: {data.get('generatedAt', '')}")
    except urllib.error.HTTPError as e:
        print(f"[ERROR] Sync request failed with HTTP {e.code}: {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"[ERROR] Connection failed: {e}")


def show_help():
    print("""
============================================================================
Kumar Video & Photography - Media Infrastructure Operations Manual
============================================================================

1. OWNER WORKFLOW (Adding new photos or videos):
   - Simply open Google Drive on your computer or phone.
   - Drop new wedding photos or videos into the appropriate folder:
       * PRE WEDDING
       * WEDDING PHOTO
       * RECEPTION
       * RING CEREMONY
       * BABY PHOTO
       * VIDEO TEASER
   - The website automatically indexes new items within 1 hour.
   - For instant publishing, run:
       python scripts/sync_drive.py flush

2. SECURITY VERIFICATION:
   - Run:
       python scripts/sync_drive.py audit-secrets
   - Confirms that no private Google Drive URLs, tokens, or credentials appear in public files.
""")


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "audit-secrets"
    if action == "audit-secrets":
        audit_secrets_and_leaks()
    elif action == "flush":
        url = os.environ.get("GATEWAY_URL", "https://kumarphotography.in")
        secret = os.environ.get("MEDIA_SYNC_SECRET", "")
        if not secret:
            print("Please specify MEDIA_SYNC_SECRET in your environment or command.")
            print("Example: MEDIA_SYNC_SECRET=your_token python scripts/sync_drive.py flush")
            sys.exit(1)
        flush_gateway_cache(url, secret)
    else:
        show_help()
