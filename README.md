# Kumar Video & Photography — Portfolio Website

> **Luxury Indian Wedding Photography & Cinematography**  
> Live Website: [https://karan24122k.github.io/Wedding_website/](https://karan24122k.github.io/Wedding_website/)

---

## Quick Overview

A lightweight, high-performance portfolio website built for luxury Indian wedding photography and cinematography. Features categorized photo collections, an interactive fullscreen lightbox, an adaptive cinematic video player supporting both wide trailers and vertical Instagram reels, seamless WhatsApp/Email inquiry routing, and content protection against casual media downloading.

---

## ⚡ Quick Start for Local Testing

```bash
# Clone or navigate to the repository:
cd "d:\Karan Arena\Wedding_website"

# Start local server:
python -m http.server 8000
```
Then visit `http://localhost:8000` in your web browser.

---

## 📁 Content Management (Adding Work)

Adding new wedding photos or films **never requires editing HTML**. Simply drop your `.webp` or `.mp4` files into the `gallery/` or `videos/` subfolders, and add an entry to [`content.json`](content.json).

```bash
# Validate that all image and video paths exist:
python scripts/manage_content.py validate

# List all current portfolio items:
python scripts/manage_content.py list
```

For complete step-by-step instructions, see the **[Operations Manual (DOCUMENTATION.md)](DOCUMENTATION.md)**.

---

## 🛠️ Tech Stack & Key Features

- **Frontend**: Clean Semantic HTML5, [Tailwind CSS](https://tailwindcss.com/) (CDN), [FontAwesome 6](https://fontawesome.com/) (CDN), Google Fonts (*Playfair Display* & *Inter*).
- **Data Model**: Centralized [`content.json`](content.json) with client-side dynamic rendering and universal offline/`file://` fallback via [`site.js`](site.js).
- **Media Engine**: Fullscreen swipeable Lightbox with couple/event metadata; video player with automatic orientation detection and manual Wide/Reel/Rotate controls.
- **Protection**: Drag-and-drop blocking, context menu deterrence with copyright toast badge, and `user-select: none`.
- **SEO & Social**: Complete Open Graph, Twitter Cards, Schema.org `PhotographyBusiness` JSON-LD, `sitemap.xml`, and `robots.txt`.
- **Deployment**: Automatic GitHub Pages deployment upon git push; zero monthly hosting fees.

---

## 📖 Complete Documentation

Please read **[`DOCUMENTATION.md`](DOCUMENTATION.md)** for:
- Detailed content management procedures
- Custom Domain & DNS configuration roadmap
- Cloudflare R2 / ImageKit media migration strategy
- Security boundaries & maintenance troubleshooting

---

&copy; 2026 Kumar Video & Photography. All visual content copyrighted.
