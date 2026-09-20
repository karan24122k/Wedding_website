# Kumar Video & Photography — Complete Technical Documentation

> **Production Guide & Operations Manual**  
> Luxury Indian Wedding Photography & Cinematography Portfolio  
> Repository: `https://github.com/karan24122k/Wedding_website`

---

## Table of Contents
1. [Architecture & Technology Stack](#1-architecture--technology-stack)
2. [Folder Structure](#2-folder-structure)
3. [Local Development](#3-local-development)
4. [Content Management Workflow (For Website Owner)](#4-content-management-workflow-for-website-owner)
5. [Media Strategy & Image/Video Guidelines](#5-media-strategy--imagevideo-guidelines)
6. [Content Protection & Limitations](#6-content-protection--limitations)
7. [Production Deployment (GitHub Pages & Custom Domain)](#7-production-deployment-github-pages--custom-domain)
8. [DNS Configuration Roadmap](#8-dns-configuration-roadmap)
9. [Long-Term Scalability & Media Migration Strategy](#9-long-term-scalability--media-migration-strategy)
10. [Maintenance & Troubleshooting](#10-maintenance--troubleshooting)

---

## 1. Architecture & Technology Stack

- **Framework**: Static HTML5 (Zero runtime framework overhead, zero build step needed).
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) via official CDN + custom [`styles.css`](file:///d:/Karan%20Arena/Wedding_website/styles.css) for animations, transitions, and protection rules.
- **Icons**: [FontAwesome 6](https://fontawesome.com/) via CDN.
- **Typography**: Google Fonts — *Playfair Display* (Editorial luxury serif for headings) & *Inter* (Clean, legible modern sans-serif for body).
- **Data Layer**: Centralized [`content.json`](file:///d:/Karan%20Arena/Wedding_website/content.json) with client-side dynamic rendering and universal fallback via [`site.js`](file:///d:/Karan%20Arena/Wedding_website/site.js).
- **Hosting**: GitHub Pages (Free, fast global CDN, automated CI/CD upon git push).

---

## 2. Folder Structure

```text
Wedding_website/
├── index.html              # Homepage (Hero, Brand story, Founder, Inquiries)
├── gallery.html            # Photography Portfolio (Categorized with Lightbox)
├── films.html              # Cinematography Portfolio (Wide/Reel player controls)
├── styles.css              # Global styles, page transitions, and protection
├── site.js                 # Fallback data, toast system, and protection handlers
├── content.json            # Central portfolio manifest (Single source of truth)
├── favicon.svg             # Vector camera logo favicon
├── robots.txt              # Search engine crawler permissions
├── sitemap.xml             # XML sitemap for SEO discovery
├── .nojekyll               # Disables Jekyll processing on GitHub Pages
├── .gitignore              # Ignores heavy raw files & OS artifacts
│
├── gallery/                # Organized web-optimized photography assets
│   ├── pre-wedding/        # e.g., sangeet-01.webp, candid-01.webp
│   ├── wedding/            # e.g., vows-01.webp, moments-01.webp, bridal-01.webp
│   └── birthdays/          # e.g., celebration-01.webp
│
├── videos/                 # Organized web-optimized video reels & films
│   ├── pre-wedding/        # Drop pre-wedding .mp4 films here
│   ├── wedding/            # e.g., reel-01.mp4 (4.2 MB FastStart H.264)
│   └── birthdays/          # Drop milestone birthday .mp4 films here
│
├── Images/                 # Core identity assets
│   └── Kumar.png           # Navbar logo
│
└── scripts/
    └── manage_content.py   # CLI tool to validate media paths and list items
```

---

## 3. Local Development

Because the site uses standard web technologies with an embedded fallback, you can run and test it immediately:

### Option A: Using Python's Built-in Server (Recommended)
```bash
# In the project root directory:
python -m http.server 8000
```
Open your browser at: `http://localhost:8000`

### Option B: Direct File Opening
You can double-click `index.html` or open it directly via `file:///`. Thanks to [`site.js`](file:///d:/Karan%20Arena/Wedding_website/site.js), the gallery and film pages automatically use embedded fallback data if browser CORS restricts `fetch('content.json')` on local disk.

---

## 4. Content Management Workflow (For Website Owner)

The website owner **never needs to edit HTML components** to add or remove work. All media entries are governed by [`content.json`](file:///d:/Karan%20Arena/Wedding_website/content.json).

### Step 1: Prepare the Media File
- **Photos**: Export as `.webp` (or `.jpg`), recommended width 1600px–2000px, file size ~150–250 KB.
- **Videos**: Export as web `.mp4` (1080p or 720p, H.264, under 10 MB, FastStart enabled).

### Step 2: Drop the File into the Appropriate Folder
- Place photo into `gallery/pre-wedding/`, `gallery/wedding/`, or `gallery/birthdays/`.
- Place video into `videos/pre-wedding/`, `videos/wedding/`, or `videos/birthdays/`.

### Step 3: Add an Entry to `content.json`

#### To add a Photo:
Open `content.json`, find the category under `"gallery"`, and add:
```json
{
  "id": "wed-05",
  "couple": "Rohan & Sneha",
  "title": "Sunset Vows",
  "caption": "Sunset Vows",
  "eventType": "Pheras Ceremony",
  "location": "Jaipur, Rajasthan",
  "year": "2026",
  "src": "gallery/wedding/sunset-vows.webp",
  "aspect": "3/2",
  "tags": ["Wedding", "Sunset", "Pheras"],
  "featured": true,
  "order": 5,
  "published": true
}
```

#### To add a Film:
Open `content.json`, find the category under `"films"`, and add:
```json
{
  "id": "film-wed-02",
  "couple": "Rohan & Sneha",
  "title": "A Royal Jaipur Affair",
  "eventType": "Highlight Film",
  "location": "Fairmont Jaipur",
  "year": "2026",
  "src": "videos/wedding/rohan-sneha-highlight.mp4",
  "poster": "gallery/wedding/sunset-vows.webp",
  "tag": "Highlight Reel",
  "orientation": "landscape",
  "aspectRatio": "16/9",
  "featured": true,
  "order": 2,
  "published": true
}
```

### Step 4: Validate and Deploy
```bash
# 1. Verify paths are accurate:
python scripts/manage_content.py validate

# 2. Push changes to GitHub:
git add -A
git commit -m "Add Rohan & Sneha wedding gallery and highlight film"
git push origin main
```
Within 60–90 seconds, GitHub Pages automatically builds and publishes the new portfolio work live!

---

## 5. Media Strategy & Image/Video Guidelines

1. **Images (`.webp`)**:
   - WebP offers ~30% higher compression efficiency than JPEG with identical perceptual quality.
   - All gallery images use `loading="lazy"` and `decoding="async"` to prevent blocking initial render.
2. **Videos (`.mp4` with FastStart)**:
   - Videos use `preload="none"` and display a high-quality poster frame until the user clicks play. This prevents burning mobile visitor data on unplayed videos.
   - Videos must have the `moov` atom at the front of the file (`-movflags +faststart` in ffmpeg) for instantaneous streaming without buffering.
3. **Aspect Ratio Hints**:
   - `content.json` specifies `"orientation": "portrait"` or `"landscape"` so vertical reels automatically format as a vertical player on page load.

---

## 6. Content Protection & Limitations

### Implemented Deterrents
1. **Disabled Drag & Drop**: Visitors cannot drag images to their desktop or search bars (`draggable="false"`).
2. **Context Menu Deterrence**: Right-clicking on portfolio photographs or videos triggers a polite copyright badge toast: *"© Kumar Video & Photography. All visual content is copyrighted."*
3. **CSS Selection Blocking**: Applied `user-select: none` and `-webkit-touch-callout: none` to prevent easy selection and long-press saving on iOS/Android.

### Transparent Technical Reality
> **Important**: No technology on the public web can 100% prevent a determined user from acquiring displayed media. A browser must download pixels to render them; users can take OS-level screenshots, inspect the network tab, or record their screen. The protections implemented here eliminate **casual downloading** (drag, right-click "Save Image As") without degrading legitimate user experience.

---

## 7. Production Deployment (GitHub Pages & Custom Domain)

The site is currently deployed via GitHub Pages from the `main` branch.

- **Default Live URL**: `https://karan24122k.github.io/Wedding_website/`
- **Hosting Tier**: GitHub Pages Free Tier
- **Bandwidth**: 100 GB/month soft limit (plenty for static pages and optimized assets)
- **Deployment Trigger**: Any push to branch `main` deploys automatically via GitHub Actions.

---

## 8. DNS Configuration Roadmap

To connect a custom domain (such as `www.kumarphotography.in` or `www.capturestories.in`):

### Step 1: Purchase Domain
Purchase your chosen domain from an ICANN-accredited registrar:
- **Recommended**: Cloudflare Registrar (at-cost pricing, no renewal markup), Namecheap, or GoDaddy.

### Step 2: Configure DNS Records at your Registrar
In your DNS Management portal, create the following records:

| Record Type | Host / Name | Target / Value | TTL | Note |
|---|---|---|---|---|
| **A** | `@` | `185.199.108.153` | Auto / 300 | GitHub Pages Edge IP 1 |
| **A** | `@` | `185.199.109.153` | Auto / 300 | GitHub Pages Edge IP 2 |
| **A** | `@` | `185.199.110.153` | Auto / 300 | GitHub Pages Edge IP 3 |
| **A** | `@` | `185.199.111.153` | Auto / 300 | GitHub Pages Edge IP 4 |
| **CNAME** | `www` | `karan24122k.github.io` | Auto / 300 | Subdomain redirect |

### Step 3: Add the Domain in GitHub Repository
1. Navigate to: `https://github.com/karan24122k/Wedding_website/settings/pages`
2. Under **Custom domain**, enter your domain (e.g. `www.kumarphotography.in`).
3. Click **Save**.
4. Check the box for **Enforce HTTPS** (TLS certificate issues automatically via Let's Encrypt within 15–30 minutes).
5. GitHub will commit a `CNAME` file to the root of your repository automatically.

---

## 9. Long-Term Scalability & Media Migration Strategy

### Current Assessment
- Current web assets: **~5.5 MB** total (4.2 MB video + 1.3 MB photos).
- GitHub repository storage limit is **1 GB**, with single-file limits of **100 MB**.
- **Verdict**: The current setup is well within limits and completely free of operating costs ($0/month).

### Migration Roadmap (When Portfolio Exceeds 200+ Photos / 500 MB)
When the studio scales to dozens of wedding films and hundreds of photos, transition media hosting to **Cloudflare R2** or **ImageKit**:

```text
┌───────────────────────────┐         ┌──────────────────────────────┐
│       GitHub Pages        │         │   Cloudflare R2 / ImageKit   │
│  (HTML, CSS, JS, Config)  │         │   (Heavy 4K Videos, Photos)  │
│         [FREE]            │         │      [FREE / < $1/month]     │
└─────────────┬─────────────┘         └──────────────┬───────────────┘
              │                                      │
              └───────────────► BROWSER ◄────────────┘
                        Loads site via CDN
```

1. **Storage Platform**: Cloudflare R2 (10 GB free storage, **0 egress fees** forever).
2. **CDN Delivery**: Custom domain like `media.kumarphotography.in`.
3. **Configuration**: In `content.json`, simply update `"src"` paths from `gallery/...` to `https://media.kumarphotography.in/gallery/...`.
4. **Result**: Zero rebuilds required; seamless instant scaling.

---

## 10. Maintenance & Troubleshooting

| Symptom | Cause | Solution |
|---|---|---|
| Image not displaying | Path typo in `content.json` | Run `python scripts/manage_content.py validate` |
| Video not playing on mobile | Missing `playsinline` or unsupported codec | Ensure MP4 is H.264 AAC with FastStart enabled |
| DNS NXDOMAIN error | Domain not yet propagated or incorrect A records | Verify DNS records using `whatsmydns.net` |
| Local page looks blank | Browser blocking `fetch()` on `file:///` | Open via `python -m http.server 8000` or rely on `site.js` embedded fallback |
