#!/usr/bin/env python3
"""
Comprehensive Production SEO & Integrity Test Suite for Kumar Video & Photography Website.
Validates HTML metadata, Schema.org JSON-LD syntax, sitemap, robots.txt, 404 page, and asset references.
"""

import os
import sys
import json
import re
import xml.etree.ElementTree as ET

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

def test_seo_metadata():
    pages = {
        "index.html": {
            "title_contains": "Kumar Video & Photography | Luxury Wedding Photography & Films",
            "canonical": "https://karan24122k.github.io/Wedding_website/",
            "is_indexable": True,
            "has_hero_preload": True
        },
        "gallery.html": {
            "title_contains": "Wedding Photography Gallery | Kumar Video & Photography",
            "canonical": "https://karan24122k.github.io/Wedding_website/gallery.html",
            "is_indexable": True,
            "has_hero_preload": False
        },
        "films.html": {
            "title_contains": "Cinematic Wedding Films & Teasers | Kumar Video & Photography",
            "canonical": "https://karan24122k.github.io/Wedding_website/films.html",
            "is_indexable": True,
            "has_hero_preload": False
        }
    }

    titles = []
    descriptions = []

    for filename, config in pages.items():
        filepath = os.path.join(ROOT_DIR, filename)
        assert os.path.exists(filepath), f"{filename} missing"
        with open(filepath, "r", encoding="utf-8") as f:
            html = f.read()

        # Check lang attribute
        assert '<html lang="en">' in html, f"{filename} missing lang=\"en\""

        # Check title
        title_match = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE)
        assert title_match, f"{filename} missing <title>"
        title = title_match.group(1).strip()
        assert title not in titles, f"Duplicate title found: '{title}' in {filename}"
        titles.append(title)

        # Check meta description
        desc_match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', html, re.IGNORECASE)
        assert desc_match, f"{filename} missing meta description"
        desc = desc_match.group(1).strip()
        assert desc not in descriptions, f"Duplicate description found in {filename}"
        descriptions.append(desc)

        # Check canonical tag
        canonical_match = re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\'](.*?)["\']', html, re.IGNORECASE)
        assert canonical_match, f"{filename} missing canonical link"
        assert canonical_match.group(1) == config["canonical"], f"{filename} canonical mismatch: expected {config['canonical']} got {canonical_match.group(1)}"

        # Check robots directive
        assert 'name="robots"' in html, f"{filename} missing robots meta tag"
        assert 'content="index, follow' in html, f"{filename} robots directive should include index, follow"

        # Check Open Graph and Twitter cards
        assert 'property="og:title"' in html, f"{filename} missing og:title"
        assert 'property="og:description"' in html, f"{filename} missing og:description"
        assert 'property="og:image"' in html, f"{filename} missing og:image"
        assert 'property="og:url"' in html, f"{filename} missing og:url"
        assert 'name="twitter:card"' in html, f"{filename} missing twitter:card"

        # Check single H1
        h1_matches = re.findall(r'<h1\b[^>]*>(.*?)</h1>', html, re.IGNORECASE | re.DOTALL)
        assert len(h1_matches) == 1, f"{filename} must have exactly one <h1> tag, found {len(h1_matches)}"

        # Check font preconnect
        assert 'rel="preconnect" href="https://fonts.googleapis.com"' in html, f"{filename} missing font preconnect"
        assert 'rel="preconnect" href="https://fonts.gstatic.com"' in html, f"{filename} missing font gstatic preconnect"

        # Check hero preload
        if config["has_hero_preload"]:
            assert 'rel="preload" as="image"' in html, f"{filename} missing hero image preload"

        # Check skip link and semantic landmarks
        assert 'href="#main-content"' in html, f"{filename} missing skip-to-content link"
        assert 'id="main-content"' in html, f"{filename} missing main landmark with id='main-content'"

        print(f"[PASS] {filename} SEO metadata, headings, and accessibility validated")

def test_schema_jsonld():
    pages = ["index.html", "gallery.html", "films.html"]
    for filename in pages:
        filepath = os.path.join(ROOT_DIR, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            html = f.read()

        # Extract all JSON-LD blocks
        matches = re.findall(r'<script\s+type=["\']application/ld\+json["\']>(.*?)</script>', html, re.DOTALL)
        assert len(matches) > 0, f"{filename} has no Schema.org JSON-LD blocks"

        for idx, block in enumerate(matches):
            try:
                data = json.loads(block.strip())
            except json.JSONDecodeError as e:
                assert False, f"{filename} JSON-LD block {idx+1} has invalid JSON syntax: {e}"

            # Check that it uses valid schema.org context
            context = data.get("@context")
            assert context == "https://schema.org" or context == "http://schema.org", f"{filename} invalid @context"

            # Check for zero fake review spam
            block_str = json.dumps(data)
            assert "aggregateRating" not in block_str, f"{filename} must NOT contain fabricated aggregateRating"
            assert "reviewRating" not in block_str, f"{filename} must NOT contain fabricated reviewRating"

        print(f"[PASS] {filename} Schema.org JSON-LD syntax and anti-spam integrity validated")

def test_sitemap_and_robots():
    # Robots.txt validation
    robots_path = os.path.join(ROOT_DIR, "robots.txt")
    assert os.path.exists(robots_path), "robots.txt missing"
    with open(robots_path, "r", encoding="utf-8") as f:
        robots = f.read()
    assert "User-agent: *" in robots, "robots.txt missing User-agent: *"
    assert "Sitemap: https://karan24122k.github.io/Wedding_website/sitemap.xml" in robots, "robots.txt missing Sitemap link"
    assert "Disallow: /scripts/" in robots, "robots.txt should disallow internal /scripts/"
    print("[PASS] robots.txt validated")

    # Sitemap.xml XML parsing validation
    sitemap_path = os.path.join(ROOT_DIR, "sitemap.xml")
    assert os.path.exists(sitemap_path), "sitemap.xml missing"
    try:
        tree = ET.parse(sitemap_path)
        root = tree.getroot()
    except ET.ParseError as e:
        assert False, f"sitemap.xml has invalid XML: {e}"

    # Extract all loc URLs
    urls = []
    for elem in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc"):
        urls.append(elem.text.strip())

    expected_urls = [
        "https://karan24122k.github.io/Wedding_website/",
        "https://karan24122k.github.io/Wedding_website/gallery.html",
        "https://karan24122k.github.io/Wedding_website/films.html"
    ]
    assert urls == expected_urls, f"Sitemap URLs mismatch. Expected {expected_urls}, found {urls}"

    # Ensure 404 is NOT in sitemap
    assert not any("404" in u for u in urls), "404.html must NOT be listed in sitemap.xml"
    print("[PASS] sitemap.xml structure and canonical URL list validated")

def test_404_page():
    path_404 = os.path.join(ROOT_DIR, "404.html")
    assert os.path.exists(path_404), "404.html missing"
    with open(path_404, "r", encoding="utf-8") as f:
        content = f.read()
    assert '<meta name="robots" content="noindex, follow">' in content, "404.html must have noindex, follow directive"
    assert 'href="index.html"' in content, "404.html must link to index.html"
    assert 'href="gallery.html"' in content, "404.html must link to gallery.html"
    assert 'href="films.html"' in content, "404.html must link to films.html"
    print("[PASS] 404.html error handling and crawl directives validated")

def test_html_assets():
    html_files = ["index.html", "gallery.html", "films.html", "404.html"]
    for hf in html_files:
        path = os.path.join(ROOT_DIR, hf)
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check for any broken local src/href references
        src_matches = re.findall(r'(?:src|href)=["\']([^"\'#:\?]+)["\']', content)
        for match in src_matches:
            if match.endswith((".html", ".css", ".js", ".svg", ".webp", ".png", ".mp4")):
                full = os.path.join(ROOT_DIR, match.replace("/", os.sep))
                assert os.path.exists(full), f"{hf}: referenced file '{match}' does not exist on disk"

        print(f"[PASS] {hf} internal asset link integrity confirmed")

if __name__ == "__main__":
    try:
        test_json_validity()
        test_seo_metadata()
        test_schema_jsonld()
        test_sitemap_and_robots()
        test_404_page()
        test_html_assets()
        print("\n==================================================")
        print("ALL 6 PRODUCTION SEO AUDIT SUITES PASSED! (100% OK)")
        print("==================================================")
    except AssertionError as e:
        print(f"\n[FAIL] {e}")
        sys.exit(1)
