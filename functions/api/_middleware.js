/**
 * Security & Rate-Limiting Middleware for Cloudflare Pages Functions
 * Enforces strict CORS, hotlink defense, rate limiting, and security headers.
 */

// In-memory sliding window rate limiter (per Cloudflare worker isolate)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // 120 reqs/min per IP

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.startTime > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, startTime: now });
    return false;
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  return false;
}

// Clean up stale rate limiter entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now - data.startTime > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. IP Rate Limiting
  const clientIp = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
  if (isRateLimited(clientIp)) {
    return new Response(
      JSON.stringify({ error: 'Too Many Requests', message: 'Rate limit exceeded. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60'
        }
      }
    );
  }

  // 2. Hotlink & Referer Defense
  const referer = request.headers.get('Referer');
  const allowedOrigin = env.ALLOWED_ORIGIN || url.origin;

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      // Allow localhost for dev, and matched host for production
      const isAllowedHost =
        refererUrl.hostname === url.hostname ||
        refererUrl.hostname === 'localhost' ||
        refererUrl.hostname === '127.0.0.1' ||
        (env.ALLOWED_ORIGIN && referer.startsWith(env.ALLOWED_ORIGIN));

      if (!isAllowedHost && !url.pathname.endsWith('/sync')) {
        return new Response('Hotlinking is strictly prohibited.', {
          status: 403,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    } catch (e) {
      // Invalid referer URL format
    }
  }

  // Handle CORS Preflight OPTIONS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // Execute downstream handler
  let response;
  try {
    response = await context.next();
  } catch (err) {
    console.error('API Error:', err);
    response = new Response(
      JSON.stringify({ error: 'Internal Server Error', message: 'A secure media processing error occurred.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Clone and append strict security headers
  const secureHeaders = new Headers(response.headers);
  secureHeaders.set('Access-Control-Allow-Origin', allowedOrigin);
  secureHeaders.set('X-Content-Type-Options', 'nosniff');
  secureHeaders.set('X-Frame-Options', 'SAMEORIGIN');
  secureHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  secureHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: secureHeaders
  });
}
