/**
 * Kumar Video & Photography - Core Client Utilities & Fallback Data
 * Provides graceful offline/file:// fallback, content protection, and inquiry helpers.
 */

// Embedded fallback data ensuring zero-failure rendering on file:/// and offline environments
const SITE_FALLBACK_DATA = {
  business: {
    name: "Kumar Video & Photography",
    phone: "1234",
    whatsappNumber: "1234",
    whatsappMessage: "Hi Kumar Video & Photography, I would like to inquire about wedding photography and cinematography packages.",
    email: "contact@kumarphotography.in"
  },
  gallery: {
    "pre-wedding": [
      { id: "pw-01", couple: "Vikram & Ananya", title: "The Royal Sangeet", caption: "The Royal Sangeet", eventType: "Pre-Wedding Celebration", location: "Udaipur, Rajasthan", year: "2025", src: "gallery/pre-wedding/sangeet-01.webp", aspect: "4/5", tags: ["Pre-Wedding", "Sangeet", "Royal"] },
      { id: "pw-02", couple: "Rohit & Meera", title: "Candid Moments", caption: "Candid Moments", eventType: "Couple Portraits", location: "Bengaluru", year: "2025", src: "gallery/pre-wedding/candid-01.webp", aspect: "3/2", tags: ["Pre-Wedding", "Candid"] }
    ],
    "wedding": [
      { id: "wed-01", couple: "Aditya & Anjali", title: "The Wedding Vows", caption: "The Wedding Vows", eventType: "Pheras Ceremony", location: "Leela Palace, Bengaluru", year: "2025", src: "gallery/wedding/vows-01.webp", aspect: "3/2", tags: ["Wedding", "Rituals"] },
      { id: "wed-02", couple: "Aditya & Anjali", title: "Wedding Moments", caption: "Wedding Moments", eventType: "Candid Vidaai", location: "Leela Palace, Bengaluru", year: "2025", src: "gallery/wedding/moments-01.webp", aspect: "3/2", tags: ["Wedding", "Emotional"] },
      { id: "wed-03", couple: "Ananya Sharma", title: "Bridal Bliss", caption: "Bridal Bliss", eventType: "Bridal Portrait", location: "Hyderabad", year: "2025", src: "gallery/wedding/bridal-01.webp", aspect: "4/5", tags: ["Wedding", "Bridal"] },
      { id: "wed-04", couple: "Karan & Simran", title: "The Grand Reception", caption: "The Grand Reception", eventType: "Grand Reception", location: "Taj West End, Bengaluru", year: "2025", src: "gallery/wedding/reception-01.webp", aspect: "16/9", tags: ["Wedding", "Reception"] }
    ],
    "birthdays": [
      { id: "bday-01", couple: "Aarav's 1st Birthday", title: "Festive Celebrations", caption: "Festive Celebrations", eventType: "Milestone Birthday", location: "Bengaluru", year: "2025", src: "gallery/birthdays/celebration-01.webp", aspect: "3/2", tags: ["Birthday", "Celebration"] }
    ]
  },
  films: {
    "pre-wedding": [
      { id: "film-pw-01", couple: "Kabir & Tara", title: "A Tuscan Romance in Udaipur", location: "Oberoi Udaivilas, Udaipur", src: "videos/pre-wedding/", poster: "gallery/pre-wedding/sangeet-01.webp", tag: "Coming Soon", orientation: "landscape", aspectRatio: "16/9" }
    ],
    "wedding": [
      { id: "film-wed-01", couple: "Aditya & Anjali", title: "The Summer Palace Wedding", location: "Leela Palace, Bengaluru", src: "videos/wedding/reel-01.mp4", poster: "gallery/wedding/reception-01.webp", tag: "Highlight Reel", orientation: "portrait", aspectRatio: "9/16" }
    ],
    "birthdays": [
      { id: "film-bday-01", couple: "Aarav's 1st Birthday", title: "One Year of Joy", location: "Bengaluru", src: "videos/birthdays/", poster: "gallery/birthdays/celebration-01.webp", tag: "Coming Soon", orientation: "landscape", aspectRatio: "16/9" }
    ]
  }
};

/**
 * Universal content loader:
 * 1. Tries secure Cloudflare Gateway (/api/manifest)
 * 2. Falls back to static manifest (content.json)
 * 3. Gracefully falls back to SITE_FALLBACK_DATA for offline/file:// protocol
 */
async function loadSiteContent() {
  // Tier 1: Cloudflare Gateway /api/manifest (Private Google Drive origin)
  try {
    const apiRes = await fetch('/api/manifest', {
      headers: { 'Accept': 'application/json' },
      cache: 'default'
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && data.gallery && !data.fallback) {
        return data;
      }
    }
  } catch (e) {
    // API not running or offline; proceed to Tier 2
  }

  // Tier 2: Static content.json
  try {
    const res = await fetch('content.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // Tier 3: In-memory fallback
    console.info('Operating under local/offline mode: loading embedded fallback data.');
    return SITE_FALLBACK_DATA;
  }
}

/**
 * Anti-Piracy Deterrent: Toast Notification
 */
let toastTimeout = null;
function showCopyrightToast(message = '© Kumar Video & Photography. All visual content is copyrighted.') {
  let toast = document.getElementById('copyright-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'copyright-toast';
    toast.className = 'copyright-toast';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = '<i class="fas fa-shield-alt text-orange-500"></i> <span id="toast-text"></span>';
    document.body.appendChild(toast);
  }

  document.getElementById('toast-text').textContent = message;
  toast.classList.add('visible');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, 2800);
}

/**
 * Initialize protection deterrents and copyright dynamic year
 */
document.addEventListener('DOMContentLoaded', () => {
  // Dynamic copyright year
  const yearSpan = document.getElementById('current-year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // Prevent drag-to-desktop on all images and videos
  document.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.closest('.gallery-item, .screening-viewport, #lightbox')) {
      e.preventDefault();
      showCopyrightToast();
    }
  });

  // Intercept right-click context menu on protected visual media
  document.addEventListener('contextmenu', (e) => {
    const protectedTarget = e.target.closest('img, video, .gallery-item, .video-card, .screening-viewport, #lightbox');
    if (protectedTarget) {
      e.preventDefault();
      showCopyrightToast();
    }
  });
});

