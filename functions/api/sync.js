/**
 * POST /api/sync
 * Flushes Cloudflare edge and memory cache and re-scans Google Drive.
 * Protected by MEDIA_SYNC_SECRET token.
 */

import { getDriveManifest } from '../_lib/gdrive.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  // Authenticate sync request
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') || url.searchParams.get('token');

  if (!env.MEDIA_SYNC_SECRET || token !== env.MEDIA_SYNC_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized', message: 'Invalid or missing sync secret' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Force refresh the manifest
    const manifest = await getDriveManifest(env, true);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Google Drive media catalog re-indexed successfully.',
        generatedAt: manifest.generatedAt,
        totalItems: Object.keys(manifest.opaqueIndex).length
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Sync failed', details: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
