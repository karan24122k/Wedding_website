#!/usr/bin/env python3
"""
Static Pre-Renderer (Build-Time SSR) for Kumar Video & Photography Website.
Reads content.json and pre-renders gallery and film cards directly into gallery.html and films.html.
Ensures instant 0ms First Contentful Paint and 100% SEO crawlers visibility without requiring a backend runtime.
"""

import os
import json
import re

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def build_gallery_html(photos, offset):
    items_html = []
    for i, photo in enumerate(photos):
        idx = offset + i
        caption = photo.get("caption") or photo.get("title") or "Wedding Photograph"
        couple = photo.get("couple") or ""
        location = f" • {photo.get('location')}" if photo.get("location") else ""
        meta_line = f'<div class="text-[11px] text-gray-500 mt-1 font-serif italic">{couple}{location}</div>' if couple else ''
        
        # Build descriptive SEO alt tag with context
        alt_desc = f"{caption} - {couple}{location} | Kumar Video & Photography" if couple else f"{caption} | Kumar Video & Photography"
        
        # Above-the-fold optimization: First card can load eagerly, subsequent cards lazy-load asynchronously
        loading_attr = 'loading="eager" fetchpriority="high"' if idx == 0 else 'loading="lazy"'

        card = f'''                <div class="gallery-item group relative overflow-hidden rounded-2xl bg-stone-200 shadow-sm transition-all duration-500 hover:shadow-xl mb-4 md:mb-6"
                     onclick="openLightbox({idx})"
                     role="button"
                     tabindex="0"
                     aria-label="{caption}">
                    <div class="relative overflow-hidden">
                        <img {loading_attr}
                             decoding="async"
                             src="{photo.get('src')}"
                             alt="{alt_desc}"
                             class="w-full h-auto object-cover protect-media block">
                        <div class="media-shield" aria-hidden="true"></div>
                    </div>
                    <div class="p-4 bg-white border-t border-stone-100">
                        <div class="text-[10px] tracking-widest uppercase font-bold text-orange-800">
                            {caption}
                        </div>
                        {meta_line}
                    </div>
                </div>'''
        items_html.append(card)
    return "\n".join(items_html)

def build_film_card_html(film, index):
    src = film.get("src", "")
    if not src or src.endswith("/"):
        tag = film.get("tag", "Coming Soon")
        loc = film.get("location", "Location upon release")
        return f'''            <div class="coming-soon-card p-6 sm:p-12">
                <i class="fas fa-film text-orange-700/60 text-4xl mb-4 block"></i>
                <h3 class="text-xl font-serif italic text-gray-800 mb-2">{film.get("title")}</h3>
                <p class="text-gray-500 text-xs uppercase tracking-widest">{loc}</p>
                <span class="mt-4 inline-block text-[10px] border border-stone-300 bg-stone-100 text-stone-600 px-4 py-1.5 rounded-full uppercase tracking-widest font-semibold">{tag}</span>
            </div>'''

    is_portrait = film.get("orientation") == "portrait"
    portrait_class = "is-portrait" if is_portrait else ""
    act_land = "active" if not is_portrait else ""
    act_port = "active" if is_portrait else ""
    loc_part = film.get("location", "")
    year_part = f" • {film.get('year')}" if film.get("year") else ""
    loc_full = f"{loc_part}{year_part}".strip()

    return f'''            <div class="video-card bg-white rounded-2xl shadow-md border border-stone-200 overflow-hidden" id="card-{index}">
                <div class="video-container {portrait_class}" id="vc-{index}">
                    <!-- Controls Toolbar -->
                    <div class="orient-toolbar">
                        <button class="orient-btn {act_land}" id="btn-land-{index}"
                                onclick="setMode({index}, 'landscape')"
                                title="Cinematic Wide View">
                            <i class="fas fa-desktop mr-1"></i> Wide
                        </button>
                        <button class="orient-btn {act_port}" id="btn-port-{index}"
                                onclick="setMode({index}, 'portrait')"
                                title="Vertical Reel Format">
                            <i class="fas fa-mobile-alt mr-1"></i> Reel
                        </button>
                        <button class="orient-btn" id="btn-rot-{index}"
                                onclick="rotateVideo({index})"
                                title="Rotate 90 Degrees">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>

                    <!-- Custom Play Overlay -->
                    <div class="play-overlay" id="play-overlay-{index}" onclick="playVideo({index})">
                        <div class="play-button-icon">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>

                    <video id="vid-{index}"
                           controls
                           preload="none"
                           playsinline
                           poster="{film.get('poster', '')}"
                           data-rot="0"
                           class="protect-media"
                           onplay="handleVideoPlay({index})">
                        <source src="{src}" type="video/mp4">
                        Your browser does not support video playback.
                    </video>
                </div>

                <!-- Video Details In Clean White Card Footer -->
                <div class="p-4 sm:p-6 bg-white border-t border-stone-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                    <div>
                        <div class="text-[10px] text-orange-700 font-bold uppercase tracking-widest">{film.get("eventType", "Wedding Film")}</div>
                        <h3 class="text-xl md:text-2xl font-serif text-gray-900 mt-1">{film.get("title")}</h3>
                        <p class="text-xs text-gray-500 uppercase tracking-widest mt-1">{loc_full}</p>
                    </div>
                    <span class="text-[10px] border border-orange-700/30 text-orange-700 bg-orange-50 px-4 py-1.5 rounded-full uppercase tracking-widest font-semibold shrink-0">
                        {film.get("tag", "Film")}
                    </span>
                </div>
            </div>'''

def prerender_gallery(data):
    gallery_file = os.path.join(ROOT_DIR, "gallery.html")
    with open(gallery_file, "r", encoding="utf-8") as f:
        html = f.read()

    gallery_data = data.get("gallery", {})
    pw = [p for p in gallery_data.get("pre-wedding", []) if p.get("published") is not False]
    wed = [p for p in gallery_data.get("wedding", []) if p.get("published") is not False]
    bday = [p for p in gallery_data.get("birthdays", []) if p.get("published") is not False]

    pw_html = build_gallery_html(pw, 0)
    wed_html = build_gallery_html(wed, len(pw))
    bday_html = build_gallery_html(bday, len(pw) + len(wed))

    # Replace content of grid-pre-wedding
    html = re.sub(
        r'(<div id="grid-pre-wedding"[^>]*>)(.*?)(</div>\s*</section>)',
        rf'\1\n{pw_html}\n            \3',
        html,
        flags=re.DOTALL
    )
    # Replace content of grid-wedding
    html = re.sub(
        r'(<div id="grid-wedding"[^>]*>)(.*?)(</div>\s*</section>)',
        rf'\1\n{wed_html}\n            \3',
        html,
        flags=re.DOTALL
    )
    # Replace content of grid-birthdays
    html = re.sub(
        r'(<div id="grid-birthdays"[^>]*>)(.*?)(</div>\s*</section>)',
        rf'\1\n{bday_html}\n            \3',
        html,
        flags=re.DOTALL
    )

    with open(gallery_file, "w", encoding="utf-8") as f:
        f.write(html)
    print("[PRE-RENDER] gallery.html updated with static pre-rendered cards.")

def prerender_films(data):
    films_file = os.path.join(ROOT_DIR, "films.html")
    with open(films_file, "r", encoding="utf-8") as f:
        html = f.read()

    films_data = data.get("films", {})
    pw = [f for f in films_data.get("pre-wedding", []) if f.get("published") is not False]
    wed = [f for f in films_data.get("wedding", []) if f.get("published") is not False]
    bday = [f for f in films_data.get("birthdays", []) if f.get("published") is not False]

    offset = 0
    pw_html = "\n".join([build_film_card_html(f, offset + i) for i, f in enumerate(pw)])
    offset += len(pw)
    wed_html = "\n".join([build_film_card_html(f, offset + i) for i, f in enumerate(wed)])
    offset += len(wed)
    bday_html = "\n".join([build_film_card_html(f, offset + i) for i, f in enumerate(bday)])

    html = re.sub(
        r'(<div id="films-pre-wedding"[^>]*>)(.*?)(</div>\s*</section>)',
        rf'\1\n{pw_html}\n            \3',
        html,
        flags=re.DOTALL
    )
    html = re.sub(
        r'(<div id="films-wedding"[^>]*>)(.*?)(</div>\s*</section>)',
        rf'\1\n{wed_html}\n            \3',
        html,
        flags=re.DOTALL
    )
    html = re.sub(
        r'(<div id="films-birthdays"[^>]*>)(.*?)(</div>\s*</section>)',
        rf'\1\n{bday_html}\n            \3',
        html,
        flags=re.DOTALL
    )

    with open(films_file, "w", encoding="utf-8") as f:
        f.write(html)
    print("[PRE-RENDER] films.html updated with static pre-rendered cards.")

def main():
    content_file = os.path.join(ROOT_DIR, "content.json")
    with open(content_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    prerender_gallery(data)
    prerender_films(data)
    print("[SUCCESS] Static pre-rendering (SSG) complete!")

if __name__ == "__main__":
    main()
