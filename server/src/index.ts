import { authenticate, isRateLimited, login, register, ApiError } from './auth.ts';
import {
  listRooms, createRoom, deleteRoom,
  pushSync, pullSync, joinByCode,
} from './rooms.ts';
import { wsOpen, wsClose } from './ws.ts';
import { stmts } from './db.ts';
import type { WsData } from './ws.ts';

const PORT          = parseInt(process.env.PORT ?? '3000', 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? '*';

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
