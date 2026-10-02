/**
 * GET /api/manifest
 * Returns the catalog of wedding photography & film works organized by category.
 * Generated dynamically from Google Drive with 1-hour Edge caching.
 */

import { getDriveManifest } from '../_lib/gdrive.js';

export async function onRequestGet(context) {
  const { env, request } = context;

  // Cloudflare Edge Cache integration
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const manifest = await getDriveManifest(env);

    // Filter out internal lookup table before sending to client
    const clientManifest = {
      generatedAt: manifest.generatedAt,
      categories: manifest.categories,
      gallery: manifest.gallery,
      films: manifest.films
    };

    const response = new Response(JSON.stringify(clientManifest, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
      }
    });

    // Store in Cloudflare Edge Cache
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    console.error('Manifest generation failed:', err.message);
    return new Response(
      JSON.stringify({
        error: 'Media Gateway Unavailable',
        message: 'Unable to synchronize with private media storage.',
        details: err.message,
        fallback: true
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}
