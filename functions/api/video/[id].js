/**
 * GET /api/video/:id
 * Streams wedding films and reels with full HTTP Range request support.
 * Enables smooth scrubbing, mobile seeking, and zero unnecessary buffering.
 */

import { resolveOpaqueId, fetchDriveVideo } from '../../_lib/gdrive.js';

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const opaqueId = params.id;
  const rangeHeader = request.headers.get('Range');

  try {
    // 1. Resolve opaque ID against authorized catalog
    const mediaMeta = await resolveOpaqueId(opaqueId, env);
    if (!mediaMeta) {
      return new Response('Video not found or unauthorized', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // 2. Fetch video stream server-side forwarding Range header
    const driveRes = await fetchDriveVideo(mediaMeta.fileId, rangeHeader, env);

    // Forward status code (206 Partial Content or 200 OK)
    const status = driveRes.status;
    const responseHeaders = new Headers();

    responseHeaders.set('Content-Type', driveRes.headers.get('content-type') || 'video/mp4');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'public, max-age=2592000, immutable');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');

    const contentRange = driveRes.headers.get('content-range');
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange);
    }

    const contentLength = driveRes.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    return new Response(driveRes.body, {
      status,
      headers: responseHeaders
    });
  } catch (err) {
    console.error(`Video delivery failed for ${opaqueId}:`, err.message);
    return new Response('Video processing error', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
