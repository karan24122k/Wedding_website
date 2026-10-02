/**
 * Google Drive Server-Side Integration for Cloudflare Pages / Workers
 * Handles RS256 JWT Service Account authentication using native Web Crypto API.
 * Never exposes credentials, raw Drive IDs, or Drive URLs to visitors.
 */

// Memory cache for active access token to avoid round-tripping Google OAuth on every request
let cachedToken = null;
let tokenExpiresAt = 0;

// Memory cache for folder manifest
let cachedManifest = null;
let manifestExpiresAt = 0;

/**
 * Converts a PEM-formatted PKCS#8 private key into a CryptoKey using Web Crypto
 */
async function importPrivateKey(pem) {
  // Clean PEM delimiters, headers, line breaks, literal \n, and whitespace
  const cleanPem = pem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');

  const binaryDerString = atob(cleanPem);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );
}

/**
 * Base64URL encoding utility compliant with RFC 7515
 */
function base64UrlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Acquires a Google OAuth2 Bearer token using Service Account JWT assertion
 */
export async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiresAt > now + 60) {
    return cachedToken;
  }

  const clientEmail = env.GOOGLE_CLIENT_EMAIL;
  const privateKeyPem = env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKeyPem) {
    throw new Error('Google Drive service account credentials not configured in environment.');
  }

  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaim = base64UrlEncode(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  const cryptoKey = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const jwt = `${signatureInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    throw new Error(`Google OAuth error (${tokenRes.status}): ${errorText}`);
  }

  const tokenData = await tokenRes.json();
  cachedToken = tokenData.access_token;
  tokenExpiresAt = now + (tokenData.expires_in || 3600);

  return cachedToken;
}

/**
 * Creates a deterministic, URL-safe opaque ID from a file name and folder name
 * e.g. "WEDDING PHOTO" + "DSC_0006.JPG" -> "wed-dsc0006"
 */
export function generateOpaqueId(folderName, fileName, fileId) {
  const prefixMap = {
    'PRE WEDDING': 'pw',
    'WEDDING PHOTO': 'wed',
    'RECEPTION': 'rec',
    'RING CEREMONY': 'ring',
    'BABY PHOTO': 'bday',
    'VIDEO TEASER': 'film'
  };

  const prefix = prefixMap[folderName] || 'media';
  const cleanName = fileName
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);

  // Short hash suffix to prevent any collision
  let hash = 0;
  for (let i = 0; i < fileId.length; i++) {
    hash = (hash << 5) - hash + fileId.charCodeAt(i);
    hash |= 0;
  }
  const suffix = Math.abs(hash).toString(36).slice(0, 4);

  return `${prefix}-${cleanName}-${suffix}`;
}

/**
 * Lists files in a given Drive folder ID
 */
async function listFilesInFolder(folderId, accessToken) {
  const files = [];
  let pageToken = '';

  do {
    const query = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, imageMediaMetadata, videoMediaMetadata, modifiedTime)',
      pageSize: '100',
      orderBy: 'name'
    });

    if (pageToken) query.set('pageToken', pageToken);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${query.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to list Drive files: ${err}`);
    }

    const data = await res.json();
    if (data.files) {
      files.push(...data.files);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}

/**
 * Parses Google Apps Script Web App JSON output into structured manifest
 */
function parseAppsScriptFeed(data) {
  const manifest = {
    generatedAt: new Date().toISOString(),
    categories: [
      { id: 'pre-wedding', name: 'Pre-Wedding', subtitle: 'The Prelude to Forever' },
      { id: 'wedding', name: 'Wedding', subtitle: 'Pledges & Sacred Traditions' },
      { id: 'reception', name: 'Reception', subtitle: 'Grand Evenings & Celebrations' },
      { id: 'ring-ceremony', name: 'Ring Ceremony', subtitle: 'Engagement & Sangeet Rituals' },
      { id: 'birthdays', name: 'Birthdays & Milestones', subtitle: 'Joyful Family Milestones' }
    ],
    gallery: {
      'pre-wedding': [],
      'wedding': [],
      'reception': [],
      'ring-ceremony': [],
      'birthdays': []
    },
    films: {
      'wedding': [],
      'pre-wedding': [],
      'birthdays': []
    },
    opaqueIndex: {}
  };

  const folderMap = {
    'PRE WEDDING': 'pre-wedding',
    'WEDDING PHOTO': 'wedding',
    'RECEPTION': 'reception',
    'RING CEREMONY': 'ring-ceremony',
    'BABY PHOTO': 'birthdays'
  };

  const gallerySource = data.gallery || {};
  for (const [folderName, items] of Object.entries(gallerySource)) {
    const fUpper = folderName.toUpperCase().trim();
    const isVideoFolder = fUpper.includes('VIDEO') || fUpper.includes('TEASER');
    const cat = folderMap[fUpper] || 'wedding';

    (items || []).forEach((item, idx) => {
      const isVideo = isVideoFolder || (item.mimeType && item.mimeType.startsWith('video/')) || (item.title && item.title.toLowerCase().endsWith('.mp4'));
      const opaqueId = generateOpaqueId(folderName, item.title || `item-${idx}`, item.id);

      manifest.opaqueIndex[opaqueId] = {
        fileId: item.id,
        name: item.title,
        folder: folderName,
        mimeType: item.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg')
      };

      if (isVideo) {
        let vCat = 'wedding';
        const tUpper = (item.title || '').toUpperCase();
        if (tUpper.includes('BIRTHDAY') || tUpper.includes('PREHAN')) vCat = 'birthdays';
        else if (tUpper.includes('PRE WEDDING')) vCat = 'pre-wedding';

        const isReel = tUpper.includes('REEL');
        manifest.films[vCat] = manifest.films[vCat] || [];
        manifest.films[vCat].push({
          id: opaqueId,
          title: cleanDisplayTitle(item.title || 'Wedding Film'),
          tag: isReel ? 'Vertical Reel' : 'Teaser Film',
          orientation: isReel ? 'portrait' : 'landscape',
          aspectRatio: isReel ? '9/16' : '16/9',
          src: `/api/video/${opaqueId}`,
          poster: `/api/media/${opaqueId}?size=card`,
          order: idx + 1,
          published: true
        });
      } else {
        manifest.gallery[cat] = manifest.gallery[cat] || [];
        manifest.gallery[cat].push({
          id: opaqueId,
          title: cleanDisplayTitle(item.title || 'Wedding Capture'),
          caption: cleanDisplayTitle(item.title || 'Wedding Capture'),
          src: `/api/media/${opaqueId}?size=card`,
          thumb: `/api/media/${opaqueId}?size=thumb`,
          full: `/api/media/${opaqueId}?size=lightbox`,
          order: idx + 1,
          published: true
        });
      }
    });
  }

  return manifest;
}

/**
 * Builds full media manifest from Google Drive structure or Apps Script feed
 */
export async function getDriveManifest(env, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedManifest && manifestExpiresAt > now) {
    return cachedManifest;
  }

  // Path 1: Google Apps Script Web App Feed (Zero Google Cloud credentials needed)
  if (env.GDRIVE_FEED_URL) {
    const feedRes = await fetch(env.GDRIVE_FEED_URL, { redirect: 'follow' });
    if (!feedRes.ok) {
      throw new Error(`Google Apps Script feed returned HTTP ${feedRes.status}`);
    }
    const rawData = await feedRes.json();
    const manifest = parseAppsScriptFeed(rawData);
    cachedManifest = manifest;
    manifestExpiresAt = now + (3600 * 1000); // 1 hour TTL
    return manifest;
  }

  // Path 2: Direct Google Drive API via Service Account
  const rootFolderId = env.GDRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error('GDRIVE_ROOT_FOLDER_ID or GDRIVE_FEED_URL is not configured');
  }

  const accessToken = await getAccessToken(env);

  // 1. Discover all subfolders in root
  const subfoldersQuery = new URLSearchParams({
    q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: '50'
  });

  const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files?${subfoldersQuery.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!folderRes.ok) {
    throw new Error(`Failed to read root Drive folder (${folderRes.status})`);
  }

  const folderData = await folderRes.json();
  const subfolders = folderData.files || [];

  const manifest = {
    generatedAt: new Date().toISOString(),
    categories: [
      { id: 'pre-wedding', name: 'Pre-Wedding', subtitle: 'The Prelude to Forever' },
      { id: 'wedding', name: 'Wedding', subtitle: 'Pledges & Sacred Traditions' },
      { id: 'reception', name: 'Reception', subtitle: 'Grand Evenings & Celebrations' },
      { id: 'ring-ceremony', name: 'Ring Ceremony', subtitle: 'Engagement & Sangeet Rituals' },
      { id: 'birthdays', name: 'Birthdays & Milestones', subtitle: 'Joyful Family Milestones' }
    ],
    gallery: {
      'pre-wedding': [],
      'wedding': [],
      'reception': [],
      'ring-ceremony': [],
      'birthdays': []
    },
    films: {
      'wedding': [],
      'pre-wedding': [],
      'birthdays': []
    },
    opaqueIndex: {}
  };

  const folderCategoryMap = {
    'PRE WEDDING': { type: 'gallery', cat: 'pre-wedding' },
    'WEDDING PHOTO': { type: 'gallery', cat: 'wedding' },
    'RECEPTION': { type: 'gallery', cat: 'reception' },
    'RING CEREMONY': { type: 'gallery', cat: 'ring-ceremony' },
    'BABY PHOTO': { type: 'gallery', cat: 'birthdays' },
    'VIDEO TEASER': { type: 'film', cat: 'wedding' }
  };

  for (const folder of subfolders) {
    const config = folderCategoryMap[folder.name.toUpperCase().trim()];
    const files = await listFilesInFolder(folder.id, accessToken);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.mimeType.startsWith('video/') || file.name.endsWith('.mp4');
      const isImage = file.mimeType.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name);

      if (!isImage && !isVideo) continue;

      const opaqueId = generateOpaqueId(folder.name, file.name, file.id);

      manifest.opaqueIndex[opaqueId] = {
        fileId: file.id,
        name: file.name,
        folder: folder.name,
        mimeType: file.mimeType,
        size: file.size
      };

      if (isVideo) {
        let targetCat = 'wedding';
        const nameUpper = file.name.toUpperCase();
        if (nameUpper.includes('BIRTHDAY') || nameUpper.includes('PREHAN')) targetCat = 'birthdays';
        else if (nameUpper.includes('PRE WEDDING')) targetCat = 'pre-wedding';

        const isReel = nameUpper.includes('REEL') || (file.videoMediaMetadata && file.videoMediaMetadata.height > file.videoMediaMetadata.width);

        manifest.films[targetCat] = manifest.films[targetCat] || [];
        manifest.films[targetCat].push({
          id: opaqueId,
          title: cleanDisplayTitle(file.name),
          tag: isReel ? 'Vertical Reel' : 'Teaser Film',
          orientation: isReel ? 'portrait' : 'landscape',
          aspectRatio: isReel ? '9/16' : '16/9',
          src: `/api/video/${opaqueId}`,
          poster: `/api/media/${opaqueId}?size=card`,
          order: i + 1,
          published: true
        });
      } else if (config) {
        manifest.gallery[config.cat] = manifest.gallery[config.cat] || [];
        manifest.gallery[config.cat].push({
          id: opaqueId,
          title: cleanDisplayTitle(file.name),
          caption: cleanDisplayTitle(file.name),
          src: `/api/media/${opaqueId}?size=card`,
          thumb: `/api/media/${opaqueId}?size=thumb`,
          full: `/api/media/${opaqueId}?size=lightbox`,
          order: i + 1,
          published: true
        });
      }
    }
  }

  cachedManifest = manifest;
  manifestExpiresAt = now + (3600 * 1000); // 1 hour TTL
  return manifest;
}

/**
 * Formats a raw camera filename into an elegant portfolio title
 */
function cleanDisplayTitle(filename) {
  let title = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/^(DSC_|_\s*DSC)/i, 'Moment #')
    .replace(/[-_]+/g, ' ')
    .trim();

  if (title.startsWith('Moment #')) {
    const num = title.replace(/\D/g, '');
    return `Royal Ceremony • Shot ${num || '01'}`;
  }
  return title;
}

/**
 * Resolves an opaque ID to internal Google Drive file metadata
 */
export async function resolveOpaqueId(opaqueId, env) {
  const manifest = await getDriveManifest(env);
  return manifest.opaqueIndex[opaqueId] || null;
}

/**
 * Fetches an image stream from Google Drive with server-side resizing
 * Uses size tokens: thumb (400px), card (1200px), lightbox (1920px)
 */
export async function fetchDriveImage(fileId, size = 'card', env) {
  const sizeMap = {
    thumb: 400,
    card: 1200,
    lightbox: 1920
  };
  const width = sizeMap[size] || 1200;

  // Path A: Authenticated Service Account
  if (env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY) {
    try {
      const accessToken = await getAccessToken(env);
      const thumbUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`;
      const authRes = await fetch(thumbUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (authRes.ok) return authRes;
    } catch (e) {
      // Fallback to direct public thumbnail
    }
  }

  // Path B: Direct High-Performance Resized Rendition (Shared Link / Apps Script)
  const directUrl = `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w${width}`;
  const res = await fetch(directUrl);
  if (res.ok) return res;

  // Fallback to drive thumbnail
  return await fetch(`https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`);
}

/**
 * Fetches video stream from Google Drive supporting HTTP Range requests
 */
export async function fetchDriveVideo(fileId, rangeHeader, env) {
  const headers = {};
  if (rangeHeader) {
    headers['Range'] = rangeHeader;
  }

  // Path A: Authenticated Service Account
  if (env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY) {
    try {
      const accessToken = await getAccessToken(env);
      headers['Authorization'] = `Bearer ${accessToken}`;
      return await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers });
    } catch (e) {
      // Fallback
    }
  }

  // Path B: Public Google Drive stream
  return await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`, { headers });
}

