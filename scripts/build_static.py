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
        year_str = f" • {film.get('year')}" if film.get("year") else ""
        return f'''            <article class="archival-plate bg-[#141210] rounded-2xl border border-stone-800/80 shadow-xl overflow-hidden p-8 sm:p-12 md:p-14 text-center max-w-2xl mx-auto">
                <span class="text-[10px] tracking-[0.25em] uppercase text-orange-600 font-semibold block mb-2.5">Archival Preview • In Post-Production</span>
                <h3 class="text-2xl sm:text-3xl font-serif text-[#faf8f5] mb-2">{film.get("title")}</h3>
                <p class="text-xs text-stone-400 uppercase tracking-widest mb-5">{loc}{year_str}</p>
                <div class="w-10 h-px bg-stone-800 mx-auto mb-5"></div>
                <p class="text-stone-400 text-xs tracking-wider max-w-md mx-auto mb-6 leading-relaxed">Master color grading and cinematic sound design in progress.</p>
                <span class="inline-block text-[10px] tracking-[0.2em] uppercase font-semibold text-stone-300 bg-stone-900/90 border border-stone-800 px-4 py-1.5 rounded-full">{tag}</span>
            </article>'''

    is_portrait = film.get("orientation") == "portrait"
    viewport_class = "is-portrait" if is_portrait else "is-theater"
    act_land = "active" if not is_portrait else ""
    act_port = "active" if is_portrait else ""
    loc_part = film.get("location", "")
    year_part = f" • {film.get('year')}" if film.get("year") else ""
    loc_full = f"{loc_part}{year_part}".strip()
    event_type = film.get("eventType", "Wedding Film")
    tag = film.get("tag", "Highlight Reel")

    return f'''            <article class="video-card screening-card bg-[#141210] rounded-2xl border border-stone-800/80 shadow-2xl overflow-hidden" id="card-{index}">
                <!-- Screening Room Header with Presentation Mode Selector -->
                <div class="screening-header px-4 py-3 sm:px-6 border-b border-stone-800/60 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-stone-400">
                    <span class="flex items-center gap-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-orange-600"></span>
                        <span class="font-medium text-stone-300">Screening Room</span>
                    </span>
                    <div class="presentation-mode-toggle flex items-center gap-1 bg-stone-900/90 p-1 rounded-full border border-stone-800 text-[10px]">
                        <button type="button" class="mode-btn {act_port} px-3 py-1 rounded-full transition text-stone-400 hover:text-stone-200" id="btn-port-{index}" onclick="setMode({index}, 'portrait')" title="Vertical Reel Format">
                            <i class="fas fa-mobile-alt mr-1"></i> Reel
                        </button>
                        <button type="button" class="mode-btn {act_land} px-3 py-1 rounded-full transition text-stone-400 hover:text-stone-200" id="btn-land-{index}" onclick="setMode({index}, 'theater')" title="Cinema Stage Presentation">
                            <i class="fas fa-desktop mr-1"></i> Stage
                        </button>
                    </div>
                </div>

                <!-- Screening Theater Stage -->
                <div class="video-container screening-theater relative overflow-hidden flex items-center justify-center p-3 sm:p-6 md:p-8" id="vc-{index}">
                    <div class="screening-viewport {viewport_class} relative w-full rounded-xl overflow-hidden bg-black shadow-2xl flex items-center justify-center" id="vp-{index}">
                        <!-- Custom Play Overlay (Fades on play) -->
                        <div class="play-overlay absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer transition-opacity duration-300 z-10" id="play-overlay-{index}" onclick="playVideo({index})" onkeydown="if(event.key==='Enter'||event.key===' '){{event.preventDefault();playVideo({index});}}" role="button" aria-label="Play {film.get('title')}" tabindex="0">
                            <div class="play-button-icon w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-orange-700/90 hover:bg-orange-700 text-white flex items-center justify-center pl-1 shadow-2xl transition-transform duration-200 hover:scale-105 border border-white/20">
                                <i class="fas fa-play text-lg sm:text-xl"></i>
                            </div>
                        </div>

                        <video id="vid-{index}"
                               controls
                               controlsList="nodownload"
                               preload="none"
                               playsinline
                               poster="{film.get('poster', '')}"
                               class="protect-media w-full h-full object-contain"
                               onplay="handleVideoPlay({index})">
                            <source src="{src}" type="video/mp4">
                            Your browser does not support video playback.
                        </video>
                    </div>
                </div>

                <!-- Colophon & Metadata Plate -->
                <div class="screening-colophon p-5 sm:p-7 bg-[#141210] border-t border-stone-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <div class="text-[10px] text-orange-600 font-semibold uppercase tracking-[0.2em] mb-1">{event_type}</div>
                        <h3 class="text-xl sm:text-2xl md:text-3xl font-serif text-[#faf8f5] tracking-tight">{film.get('title')}</h3>
                        <p class="text-xs text-stone-400 uppercase tracking-widest mt-1">{loc_full}</p>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        <span class="text-[10px] uppercase tracking-[0.18em] font-medium text-stone-300 bg-stone-900 border border-stone-800 px-3.5 py-1.5 rounded-full">
                            {tag}
                        </span>
                        <a href="index.html#contact" class="text-[10px] uppercase tracking-[0.18em] font-medium text-white bg-orange-700 hover:bg-orange-600 px-4 py-1.5 rounded-full transition shadow-sm">
                            Inquire
                        </a>
                    </div>
                </div>
            </article>'''

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
