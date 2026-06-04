import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { stmts } from './db.ts';
import type { AccountRow } from './db.ts';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

const JWT_EXPIRY = '30d';

// ── JWT ───────────────────────────────────────────────────────────────────────

export function signToken(accountId: string, email: string): string {
  return jwt.sign({ sub: accountId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

/** Extract Bearer token from Authorization header. */
export function bearerToken(req: Request): string | null {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

/** Middleware helper — returns the account or null. */
export function authenticate(req: Request): AccountRow | null {
  const token = bearerToken(req);
  if (!token) return null;
  const accountId = verifyToken(token);
  if (!accountId) return null;
  return stmts.findAccountById.get(accountId) ?? null;
}

// ── Register / Login ──────────────────────────────────────────────────────────

export async function register(
  email: string,
  password: string,
): Promise<{ token: string }> {
  const existing = stmts.findAccountByEmail.get(email);
  if (existing) throw new ApiError(409, 'An account with that email already exists.');

  validateEmail(email);
  validatePassword(password);

  const hash = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();
  const normalised = email.toLowerCase().trim();
  stmts.insertAccount.run(id, normalised, hash, Date.now());

  return { token: signToken(id, normalised) };
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string }> {
  const account = stmts.findAccountByEmail.get(email.toLowerCase().trim());
  if (!account) throw new ApiError(401, 'Invalid email or password.');

  const ok = await bcrypt.compare(password, account.password_hash);
  if (!ok) throw new ApiError(401, 'Invalid email or password.');

  return { token: signToken(account.id, account.email) };
}

// ── Rate limiter (in-memory, per IP) ─────────────────────────────────────────

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/** Returns true if the IP is over the limit. */
export function isRateLimited(ip: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > maxPerMinute;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) rateLimitStore.delete(key);
  }
}, 5 * 60_000);

// ── Validation ────────────────────────────────────────────────────────────────

function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'Invalid email address.');
  }
}

function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters.');
  }
}

// ── Shared error class ────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
