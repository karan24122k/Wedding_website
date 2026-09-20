#!/usr/bin/env python3
"""
Test Suite for Kumar Video & Photography Website
Verifies HTML structure, assets, links, and content.json integrity.
"""

import os
import sys
import json
import re

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def test_json_validity():
    content_file = os.path.join(ROOT_DIR, "content.json")
    assert os.path.exists(content_file), "content.json missing"
    with open(content_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert "gallery" in data, "gallery key missing from content.json"
    assert "films" in data, "films key missing from content.json"
    assert "business" in data, "business key missing from content.json"
    print("[PASS] content.json is valid and complete")

def test_html_assets():
    html_files = ["index.html", "gallery.html", "films.html"]
    for hf in html_files:
        path = os.path.join(ROOT_DIR, hf)
        assert os.path.exists(path), f"{hf} missing"
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Check title
        assert "<title>" in content and "</title>" in content, f"{hf} missing title"
        
        # Check favicon link
        assert 'href="favicon.svg"' in content, f"{hf} missing favicon link"
        
        # Check styles.css link
        assert 'href="styles.css"' in content, f"{hf} missing styles.css link"
        
        # Check site.js script
        assert 'src="site.js"' in content, f"{hf} missing site.js"

        # Check for any broken local src references (src="gallery/..." or src="Images/...")
        src_matches = re.findall(r'(?:src|href)=["\']([^"\'#:\?]+)["\']', content)
        for match in src_matches:
            if match.endswith(".html") or match.endswith(".css") or match.endswith(".js") or match.endswith(".svg") or match.endswith(".webp") or match.endswith(".png") or match.endswith(".mp4"):
                full = os.path.join(ROOT_DIR, match.replace("/", os.sep))
                assert os.path.exists(full), f"{hf}: referenced file '{match}' does not exist on disk"
        
        print(f"[PASS] {hf} structure and local asset references validated")

def test_seo_files():
    assert os.path.exists(os.path.join(ROOT_DIR, "robots.txt")), "robots.txt missing"
    assert os.path.exists(os.path.join(ROOT_DIR, "sitemap.xml")), "sitemap.xml missing"
    assert os.path.exists(os.path.join(ROOT_DIR, ".nojekyll")), ".nojekyll missing"
    print("[PASS] SEO & GitHub Pages control files verified")

if __name__ == "__main__":
    try:
        test_json_validity()
        test_html_assets()
        test_seo_files()
        print("\nALL AUTOMATED TESTS PASSED SUCCESSFULLY! (100% integrity)")
    except AssertionError as e:
        print(f"\n[FAIL] {e}")
        sys.exit(1)
