import crypto from 'node:crypto';

import { hashId, nowIso } from './repo.js';

const SESSION_COOKIE = 'img_session';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function b64(buf) {
  return Buffer.from(buf).toString('base64url');
}

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function randomToken(bytes = 24) {
  return b64(crypto.randomBytes(bytes));
}

export function scryptHash(password, saltB64) {
  const salt = Buffer.from(saltB64, 'base64');
  const derived = crypto.scryptSync(String(password), salt, 64, { N: 1 << 14, r: 8, p: 1 });
  return b64(derived);
}

export function createPasswordHash(password) {
  const salt = crypto.randomBytes(16);
  const saltB64 = Buffer.from(salt).toString('base64');
  const hash = scryptHash(password, saltB64);
  return { saltB64, hash };
}

export function timingSafeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function setSessionCookie(res, sessionId) {
  // SameSite Lax works well for local + avoids most CSRF issues for simple POSTs.
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: String(process.env.COOKIE_SECURE || '') === '1',
    path: '/',
    maxAge: SESSION_TTL_MS
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function getSessionId(req) {
  return String(req.cookies?.[SESSION_COOKIE] || '').trim();
}

export function createSession(db, userId, req) {
  const id = randomToken(24);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '');
  const ua = String(req.headers['user-agent'] || '');

  db.prepare(
    `
    INSERT INTO user_sessions(id, user_id, created_at, expires_at, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `
  ).run(id, userId, createdAt, expiresAt, ip.slice(0, 200), ua.slice(0, 300));

  return { id, createdAt, expiresAt };
}

export function deleteSession(db, sessionId) {
  if (!sessionId) return;
  db.prepare('DELETE FROM user_sessions WHERE id = ?').run(sessionId);
}

export function getUserBySession(db, sessionId) {
  if (!sessionId) return null;
  const row = db
    .prepare(
      `
      SELECT u.id, u.email, u.display_name, u.avatar_url, s.expires_at
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
      LIMIT 1
    `
    )
    .get(sessionId);
  if (!row) return null;
  const exp = new Date(String(row.expires_at || '')).getTime();
  if (!exp || Date.now() > exp) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || '',
    avatarUrl: row.avatar_url || ''
  };
}

export function requireUser(db, req, res) {
  const sid = getSessionId(req);
  const u = getUserBySession(db, sid);
  if (!u) {
    res.status(401).json({ error: 'not_authenticated' });
    return null;
  }
  return u;
}

// --- CAPTCHA (hCaptcha / reCAPTCHA v2/v3) ---
export async function verifyCaptcha({ token, ip } = {}) {
  const bypass = String(process.env.CAPTCHA_BYPASS || '') === '1';
  if (bypass) return { ok: true, provider: 'bypass' };

  const t = String(token || '').trim();
  if (!t) return { ok: false, error: 'missing_captcha' };

  // Prefer hCaptcha if configured.
  const hSecret = String(process.env.HCAPTCHA_SECRET || '').trim();
  if (hSecret) {
    const body = new URLSearchParams();
    body.set('secret', hSecret);
    body.set('response', t);
    if (ip) body.set('remoteip', String(ip));

    const res = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await res.json().catch(() => ({}));
    return { ok: !!data.success, provider: 'hcaptcha', raw: data };
  }

  const rSecret = String(process.env.RECAPTCHA_SECRET || '').trim();
  if (rSecret) {
    const body = new URLSearchParams();
    body.set('secret', rSecret);
    body.set('response', t);
    if (ip) body.set('remoteip', String(ip));
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await res.json().catch(() => ({}));
    return { ok: !!data.success, provider: 'recaptcha', raw: data };
  }

  // No captcha configured: treat as failure to avoid accidental unguarded writes in prod.
  return { ok: false, error: 'captcha_not_configured' };
}

// --- Password reset tokens ---
export function createPasswordReset(db, userId) {
  const token = randomToken(28);
  const tokenHash = sha256(token);
  const id = hashId('pwreset', `${userId}:${tokenHash}:${Date.now()}`);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
  db.prepare(
    `
    INSERT INTO password_resets(id, user_id, token_hash, created_at, expires_at, used_at)
    VALUES (?, ?, ?, ?, ?, NULL)
  `
  ).run(id, userId, tokenHash, createdAt, expiresAt);
  return { token, expiresAt };
}

export function consumePasswordReset(db, email, token) {
  const e = normalizeEmail(email);
  const tokenHash = sha256(token);
  const row = db
    .prepare(
      `
      SELECT pr.id, pr.user_id, pr.expires_at, pr.used_at
      FROM password_resets pr
      JOIN users u ON u.id = pr.user_id
      WHERE u.email = ?
        AND pr.token_hash = ?
      ORDER BY pr.created_at DESC
      LIMIT 1
    `
    )
    .get(e, tokenHash);
  if (!row) return { ok: false, error: 'invalid_token' };
  if (row.used_at) return { ok: false, error: 'token_used' };
  const exp = new Date(String(row.expires_at || '')).getTime();
  if (!exp || Date.now() > exp) return { ok: false, error: 'token_expired' };

  db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(nowIso(), row.id);
  return { ok: true, userId: row.user_id };
}

