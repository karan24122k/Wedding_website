/**
 * Kumar Video & Photography - Core Client Utilities & Fallback Data
 * Provides graceful offline/file:// fallback, content protection, and inquiry helpers.
 */

// Embedded fallback data ensuring zero-failure rendering on file:/// and offline environments
const SITE_FALLBACK_DATA = {
  business: {
    name: "Kumar Video & Photography",
    phone: "+91 00000 00000",
    whatsappNumber: "910000000000",
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
 * Universal content loader: tries fetch('content.json'), gracefully falls back to SITE_FALLBACK_DATA
 */
async function loadSiteContent() {
  try {
    const res = await fetch('content.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.info('Loading embedded fallback data (operating offline or under file:// protocol)');
    return SITE_FALLBACK_DATA;
  }
}

/**
 * Toast Notification Utility
 */
function showToast(message, duration = 3000) {
  let toast = document.getElementById('protection-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'protection-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

/**
 * Content Protection Deterrents
 * Note: Browser client security is a deterrence against casual saving.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Prevent dragging on images
  document.querySelectorAll('img, video').forEach(media => {
    media.setAttribute('draggable', 'false');
    media.addEventListener('dragstart', e => e.preventDefault());
  });

  // Right-click deterrence on media containers
  document.addEventListener('contextmenu', e => {
    if (e.target.closest('.gallery-item, .video-container, .hero-bg')) {
      e.preventDefault();
      showToast('© Kumar Video & Photography. All visual content is copyrighted.');
    }
  });

  // Dynamic copyright year
  const yearSpan = document.getElementById('current-year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
});
