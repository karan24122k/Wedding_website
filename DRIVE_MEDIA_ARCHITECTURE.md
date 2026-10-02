# Private Google Drive Media Architecture & Deployment Guide

This document details the production media delivery architecture for **Kumar Video & Photography**, connecting a private Google Drive repository to Cloudflare Pages via a secure, authenticated server-side gateway.

---

## 1. System Architecture Overview

```text
VISITOR BROWSER
      │
      │ 1. Request static assets & media
      ▼
Cloudflare Pages (Custom Domain: e.g., https://kumarphotography.in)
      │
      ├── Static Assets (HTML, Tailwind CSS, WebGL Shaders, Vanilla JS)
      │
      └── API Gateway (Cloudflare Pages Functions / Cloudflare Worker)
            │
            ├── Security Controls (Rate limiting, CORS, CSP, Hotlink rejection)
            ├── Opaque ID Resolution (Translates opaque IDs -> Drive File IDs)
            ├── Edge Caching (Cloudflare Cache API: 30 days for media, 1 hr for manifests)
            │
            │ 2. Server-side RS256 JWT Authentication
            ▼
      Google Cloud OAuth2 Token Endpoint
            │
            │ 3. Authenticated Stream Request (Bearer Access Token)
            ▼
      PRIVATE Google Drive (Service Account Read-Only Access)
            │
            └── TEASER WEBSITE/
                  ├── BABY PHOTO/      (20 photos)
                  ├── PRE WEDDING/     (14 photos)
                  ├── RECEPTION/       (31 photos)
                  ├── RING CEREMONY/   (22 photos)
                  ├── VIDEO TEASER/    (9 video films)
                  └── WEDDING PHOTO/   (134 photos)
```

---

## 2. Security Model & Deterrence Layers

### Security Realities
No browser-rendered image or video can be 100% prevented from being screen-captured or recorded by a determined user. The browser must receive decoded pixel frames to render them.

Therefore, our architecture enforces **defense-in-depth deterrence**:

| Threat | Mitigation Enforced |
|---|---|
| **Direct Drive Access** | Visitors never receive Google Drive folder URLs, file URLs, or credentials. |
| **Credential Leakage** | Service account private key is stored exclusively in Cloudflare encrypted secrets. |
| **Full-Resolution Scraping** | The gateway delivers web-optimized renditions (`thumb`, `card`, `lightbox`) rather than raw 30MB camera originals. |
| **Arbitrary File Access** | Gateway maintains an allowed opaque ID index; visitors cannot request arbitrary Google Drive file IDs. |
| **Bulk Scraping & Hotlinking** | Gateway rate limits requests per IP and verifies Origin / Referer headers. |
| **Casual Download** | Browser UI context menu disabled on media elements, drag-to-desktop disabled (`draggable="false"`), and CSS user-selection blocked. |
| **Video Playback Scrubbing** | Full HTTP Range request support (`206 Partial Content`, `Accept-Ranges: bytes`) enabling smooth video seeking without downloading whole files. |

---

## 3. Cloudflare Pages Functions API Endpoints

All client requests communicate strictly with our own domain endpoints:

1. `GET /api/manifest`
   - Returns the full portfolio manifest organized by category with opaque media IDs.
2. `GET /api/gallery/:category`
   - Returns the photos for a category (`pre-wedding`, `wedding`, `birthdays`, `reception`, `ring-ceremony`).
3. `GET /api/media/:id?size=thumb|card|lightbox`
   - Streams the optimized, resized image through the server-side gateway.
4. `GET /api/video/:id`
   - Streams video with HTTP Range support (`206 Partial Content`).
5. `POST /api/sync` (Protected by `SYNC_TOKEN`)
   - Forces an immediate cache invalidation and re-scan of the Google Drive folder.

---

## 4. Google Drive & Service Account Setup

To connect Google Drive without making any folder public:

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project named `Kumar-Photography-Media`.
3. Enable the **Google Drive API** under **APIs & Services > Library**.
4. Navigate to **APIs & Services > Credentials** > **Create Credentials > Service Account**.
5. Name it `drive-media-reader`.
6. Once created, click on the service account > **Keys** tab > **Add Key > Create new key > JSON**.
7. Download the JSON key file. It contains `client_email` and `private_key`.
8. Open your Google Drive folder (`TEASER WEBSITE`).
9. Click **Share**, and share the folder with the Service Account email (e.g., `drive-media-reader@kumar-photography.iam.gserviceaccount.com`) as **Viewer**.
10. The folder remains strictly **PRIVATE** to everyone else on the Internet.

---

## 5. Cloudflare Environment Secrets

In the Cloudflare Dashboard, go to **Workers & Pages > Your Project > Settings > Variables and Secrets**:

| Variable Name | Type | Description |
|---|---|---|
| `GDRIVE_ROOT_FOLDER_ID` | Environment Variable | The root Google Drive folder ID (`1_JX_WEdxdiBUZ4S1QavDEiqVZJGezPUj`). |
| `GOOGLE_CLIENT_EMAIL` | Environment Variable | Service account email (`xxx@xxx.iam.gserviceaccount.com`). |
| `GOOGLE_PRIVATE_KEY` | Encrypted Secret | The private key string from the service account JSON (`-----BEGIN PRIVATE KEY-----\n...`). |
| `ALLOWED_ORIGIN` | Environment Variable | Your custom domain (e.g., `https://kumarphotography.in`). |
| `MEDIA_SYNC_SECRET` | Encrypted Secret | A random secure token used to trigger `/api/sync`. |

---

## 6. Owner Workflow: Adding New Work

The studio owner never needs to touch HTML or CSS:

1. Open Google Drive on desktop or mobile app.
2. Navigate to `TEASER WEBSITE` > choose or create a folder (e.g. `WEDDING PHOTO`, `PRE WEDDING`, `VIDEO TEASER`).
3. Drag and drop new photos (`.jpg`, `.webp`) or films (`.mp4`).
4. That's it!
   - The Cloudflare gateway automatically discovers new uploads upon cache expiry (1 hour TTL).
   - For immediate live updates, the owner can click a bookmark or run `python scripts/sync_drive.py --flush`.
