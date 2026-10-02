/**
 * GET /api/media/:id?size=thumb|card|lightbox
 * Streams resized photography through server-side gateway.
 * Zero exposure of Google Drive IDs, URLs, or credentials.
 */

import { resolveOpaqueId, fetchDriveImage } from '../../_lib/gdrive.js';

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const opaqueId = params.id;
  const url = new URL(request.url);
  const size = url.searchParams.get('size') || 'card';

  // Validate size parameter
  if (!['thumb', 'card', 'lightbox'].includes(size)) {
    return new Response('Invalid size parameter', { status: 400 });
  }

  // Edge cache lookup
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    // 1. Resolve opaque ID against authorized manifest
    const mediaMeta = await resolveOpaqueId(opaqueId, env);
    if (!mediaMeta) {
      return new Response('Media not found or unauthorized', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // 2. Fetch resized image stream server-side
    const driveRes = await fetchDriveImage(mediaMeta.fileId, size, env);
    if (!driveRes.ok) {
      return new Response('Failed to retrieve image from origin', {
        status: driveRes.status,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    const contentType = driveRes.headers.get('content-type') || 'image/jpeg';

    // 3. Construct clean edge response
    const clientResponse = new Response(driveRes.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=2592000, immutable', // 30-day edge cache
        'X-Content-Type-Options': 'nosniff'
      }
    });

    // Cache at edge
    context.waitUntil(cache.put(cacheKey, clientResponse.clone()));
    return clientResponse;
  } catch (err) {
    console.error(`Media delivery failed for ${opaqueId}:`, err.message);
    return new Response('Media processing error', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
