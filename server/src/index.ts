import { authenticate, isRateLimited, login, register, ApiError } from './auth.ts';
import {
  listRooms, createRoom, deleteRoom,
  pushSync, pullSync, joinByCode,
} from './rooms.ts';
import { wsOpen, wsClose } from './ws.ts';
import { stmts } from './db.ts';
import type { WsData } from './ws.ts';
import { join, resolve } from 'node:path';

const PUBLIC_DIR = resolve('./public');

const PORT          = parseInt(process.env.PORT ?? '3000', 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? '*';

// ── Static asset cache headers ────────────────────────────────────────────────
// sw.js / workbox-*.js  → no-cache so browsers always check for SW updates.
// index.html            → no-cache so the app shell is always fresh.
// Hashed assets (app-<hash>.js, app-<hash>.css, fonts, sprites)
//                       → immutable for 1 year; hash in filename guarantees a
//                         new URL on every deploy, so no stale content is served.
// Everything else       → revalidate after 1 hour.

function staticCacheHeaders(pathname: string): HeadersInit {
  if (/\/(sw\.js|workbox-[^/]+\.js)$/.test(pathname)) {
    return { 'Cache-Control': 'no-cache' };
  }
  // Hashed assets: Vite puts them under /assets/ with a content hash in the name
  if (/^\/assets\//.test(pathname)) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' };
  }
  // Sprites / fonts — stable game assets, cache for 90 days
  if (/^\/(sprites|fonts)\//.test(pathname)) {
    return { 'Cache-Control': 'public, max-age=7776000' };
  }
  // Everything else (manifest, icons, gamedata.json …) — revalidate hourly
  return { 'Cache-Control': 'public, max-age=3600' };
}

// ── CORS helper ───────────────────────────────────────────────────────────────

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin':  CLIENT_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function err(status: number, message: string): Response {
  return json({ error: message }, status);
}

function clientIp(req: Request, server: Bun.Server): string {
  return server.requestIP(req)?.address ?? 'unknown';
}

// ── Router ────────────────────────────────────────────────────────────────────

const server = Bun.serve<WsData>({
  port: PORT,
  hostname: '0.0.0.0',

  // ── WebSocket upgrade ──────────────────────────────────────────────────────
  fetch(req, server) {
    const url = new URL(req.url);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // WebSocket upgrade: /ws?code=<charCode>
    if (url.pathname === '/ws') {
      const code = url.searchParams.get('code');
      if (!code) return err(400, 'code query param required');

      const slot = stmts.findSlotByCode.get(code);
      if (!slot) return err(401, 'Invalid invite code');

      const ok = server.upgrade(req, {
        data: { roomId: slot.room_id, slotIndex: slot.slot_index } satisfies WsData,
      });
      return ok ? undefined : err(500, 'WebSocket upgrade failed');
    }

    return handleHttp(req, server);
  },

  websocket: {
    open(ws) { wsOpen(ws); },
    close(ws) { wsClose(ws); },
    message() { /* guests are receive-only */ },
  },
});

console.log(`Stardew Companion sync server running on port ${PORT}`);

// ── HTTP handler ──────────────────────────────────────────────────────────────

async function handleHttp(req: Request, server: Bun.Server): Promise<Response> {
  try {
    return await route(req, server);
  } catch (e) {
    if (e instanceof ApiError) return err(e.status, e.message);
    console.error('Unhandled error:', e);
    return err(500, 'Internal server error');
  }
}

async function route(req: Request, server: Bun.Server): Promise<Response> {
  const url    = new URL(req.url);
  const path   = url.pathname;
  const method = req.method;
  const ip     = clientIp(req, server);

  // POST /auth/register
  if (method === 'POST' && path === '/auth/register') {
    if (isRateLimited(ip, 10)) return err(429, 'Too many requests — please wait a minute.');
    const { email, password } = await parseBody(req);
    const result = await register(email, password);
    return json(result, 201);
  }

  // POST /auth/login
  if (method === 'POST' && path === '/auth/login') {
    if (isRateLimited(ip, 10)) return err(429, 'Too many requests — please wait a minute.');
    const { email, password } = await parseBody(req);
    const result = await login(email, password);
    return json(result);
  }

  // DELETE /auth/account
  if (method === 'DELETE' && path === '/auth/account') {
    const account = authenticate(req);
    if (!account) return err(401, 'Unauthorized');
    stmts.deleteAccount.run(account.id);
    return json({ ok: true });
  }

  // GET /rooms
  if (method === 'GET' && path === '/rooms') {
    const account = authenticate(req);
    if (!account) return err(401, 'Unauthorized');
    return json({ rooms: listRooms(account) });
  }

  // POST /rooms
  if (method === 'POST' && path === '/rooms') {
    const account = authenticate(req);
    if (!account) return err(401, 'Unauthorized');
    const { name, characters } = await parseBody(req);
    const result = createRoom(account, name, characters);
    return json(result, 201);
  }

  // DELETE /rooms/:id
  const deleteRoomMatch = path.match(/^\/rooms\/([^/]+)$/);
  if (method === 'DELETE' && deleteRoomMatch) {
    const account = authenticate(req);
    if (!account) return err(401, 'Unauthorized');
    deleteRoom(account, deleteRoomMatch[1]);
    return json({ ok: true });
  }

  // PUT /rooms/:id/sync
  const syncMatch = path.match(/^\/rooms\/([^/]+)\/sync$/);
  if (method === 'PUT' && syncMatch) {
    const account = authenticate(req);
    if (!account) return err(401, 'Unauthorized');
    const { sharedBlob, charactersBlob } = await parseBody(req);
    pushSync(account, syncMatch[1], sharedBlob, charactersBlob);
    return json({ ok: true });
  }

  // GET /rooms/:id/sync  (host pull)
  if (method === 'GET' && syncMatch) {
    const account = authenticate(req);
    if (!account) return err(401, 'Unauthorized');
    const result = pullSync(account, syncMatch[1]);
    return json(result);
  }

  // GET /join/:code
  const joinMatch = path.match(/^\/join\/([^/]+)$/);
  if (method === 'GET' && joinMatch) {
    if (isRateLimited(ip, 20)) return err(429, 'Too many requests — please wait a minute.');
    const result = joinByCode(joinMatch[1]);
    return json(result);
  }

  // GET /health
  if (method === 'GET' && path === '/health') {
    return json({ ok: true });
  }

  // ── Static file serving (SPA) ───────────────────────────────────────────────
  try {
    const requested = resolve(join(PUBLIC_DIR, url.pathname));
    // Path traversal guard
    if (requested.startsWith(PUBLIC_DIR)) {
      const file = Bun.file(requested);
      if (await file.exists()) {
        return new Response(file, { headers: staticCacheHeaders(url.pathname) });
      }
    }
    // SPA fallback — serve index.html for any client-side route
    const index = Bun.file(join(PUBLIC_DIR, 'index.html'));
    if (await index.exists()) {
      return new Response(index, {
        headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' },
      });
    }
  } catch { /* public dir not present (local API-only dev) */ }

  return err(404, 'Not found');
}

// ── Body parser ───────────────────────────────────────────────────────────────

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON.');
  }
}
