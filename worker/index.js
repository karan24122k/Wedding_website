/**
 * Standalone Cloudflare Worker for Kumar Video & Photography Media Gateway
 * Can be deployed either independently or as part of Cloudflare Pages.
 */

import { getDriveManifest, resolveOpaqueId, fetchDriveImage, fetchDriveVideo } from '../functions/_lib/gdrive.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const clientIp = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
    const allowedOrigin = env.ALLOWED_ORIGIN || url.origin;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin,
          'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    const path = url.pathname;

    // Route: GET /api/manifest
    if (path === '/api/manifest') {
      const cache = caches.default;
      const cacheKey = new Request(request.url, request);
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      try {
        const manifest = await getDriveManifest(env);
        const res = new Response(
          JSON.stringify({
            generatedAt: manifest.generatedAt,
            categories: manifest.categories,
            gallery: manifest.gallery,
            films: manifest.films
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': allowedOrigin,
              'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
              'X-Content-Type-Options': 'nosniff'
            }
          }
        );
        ctx.waitUntil(cache.put(cacheKey, res.clone()));
        return res;
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message, fallback: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigin }
        });
      }
    }

    // Route: GET /api/media/:id
    const mediaMatch = path.match(/^\/api\/media\/([a-zA-Z0-9_-]+)/);
    if (mediaMatch) {
      const cache = caches.default;
      const cacheKey = new Request(request.url, request);
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      const opaqueId = mediaMatch[1];
      const size = url.searchParams.get('size') || 'card';
      const meta = await resolveOpaqueId(opaqueId, env);
      if (!meta) {
        return new Response('Not found', { status: 404, headers: { 'Access-Control-Allow-Origin': allowedOrigin } });
      }

      const res = await fetchDriveImage(meta.fileId, size, env);
      const headers = new Headers(res.headers);
      headers.set('Access-Control-Allow-Origin', allowedOrigin);
      headers.set('Cache-Control', 'public, max-age=2592000, immutable');
      headers.set('X-Content-Type-Options', 'nosniff');
      const response = new Response(res.body, { status: res.status, headers });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }

    // Route: GET /api/video/:id
    const videoMatch = path.match(/^\/api\/video\/([a-zA-Z0-9_-]+)/);
    if (videoMatch) {
      const opaqueId = videoMatch[1];
      const meta = await resolveOpaqueId(opaqueId, env);
      if (!meta) {
        return new Response('Not found', { status: 404, headers: { 'Access-Control-Allow-Origin': allowedOrigin } });
      }

      const range = request.headers.get('Range');
      const res = await fetchDriveVideo(meta.fileId, range, env);
      const headers = new Headers(res.headers);
      headers.set('Access-Control-Allow-Origin', allowedOrigin);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'public, max-age=2592000, immutable');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(res.body, { status: res.status, headers });
    }

    // Route: POST /api/sync
    if (path === '/api/sync' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '') || url.searchParams.get('token');
      if (!env.MEDIA_SYNC_SECRET || token !== env.MEDIA_SYNC_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
      const manifest = await getDriveManifest(env, true);
      return new Response(JSON.stringify({ success: true, count: Object.keys(manifest.opaqueIndex).length }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigin }
      });
    }

    // Serve static site assets (HTML, CSS, JS, images)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
