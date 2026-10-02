/**
 * GET /api/gallery/:category
 * Returns photos for a single category (e.g., pre-wedding, wedding, reception, birthdays)
 */

import { getDriveManifest } from '../../_lib/gdrive.js';

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const category = (params.category || '').toLowerCase();

  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const manifest = await getDriveManifest(env);
    const photos = manifest.gallery[category];

    if (!photos) {
      return new Response(JSON.stringify({ error: 'Category not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const res = new Response(JSON.stringify({ category, items: photos }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600'
      }
    });

    context.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
