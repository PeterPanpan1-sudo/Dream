import { randomBytes } from 'crypto';
import fetch from 'node-fetch';

function tmUrl(workerUrl, path, query = {}) {
  const ep = `${workerUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const u = new URL(ep);
  Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v)); });
  return u.toString();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export async function callTempMailAdmin(workerUrl, adminAuth, path, { method = 'GET', body = null, query = {} } = {}) {
  const res = await fetchWithTimeout(tmUrl(workerUrl, path, query), {
    method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/plain, */*', 'x-admin-auth': adminAuth },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text(); let d; try { d = JSON.parse(raw); } catch { d = raw; }
  if (!res.ok) throw new Error(d?.error || d?.message || raw || `temp-mail fail ${res.status}`);
  return d;
}

export async function callTempMailMailbox(workerUrl, jwt, path, { method = 'GET', body = null, query = {} } = {}) {
  if (!jwt) throw new Error('missing jwt');
  const res = await fetchWithTimeout(tmUrl(workerUrl, path, query), {
    method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/plain, */*', 'Authorization': `Bearer ${jwt}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text(); let d; try { d = JSON.parse(raw); } catch { d = raw; }
  if (!res.ok) throw new Error(d?.error || d?.message || raw || `mailbox fail ${res.status}`);
  return d;
}

function deepFind(v, keys) {
  const ks = new Set(keys.map(k => k.toLowerCase()));
  const s = new Set();
  function go(c) {
    if (!c || typeof c !== 'object' || s.has(c)) return null;
    s.add(c);
    for (const [k, child] of Object.entries(c)) {
      if (ks.has(k.toLowerCase()) && child !== undefined && child !== null && child !== '') return child;
    }
    for (const child of Array.isArray(c) ? c : Object.values(c)) {
      const f = go(child);
      if (f !== null && f !== undefined && f !== '') return f;
    }
    return null;
  }
  return go(v);
}

export function extractEmailFromResponse(d, fb) {
  const v = deepFind(d, ['email', 'address', 'mail', 'mailAddress']);
  const t = typeof v === 'string' ? v : JSON.stringify(d || '');
  const m = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : fb.toLowerCase();
}

export function extractJwtFromResponse(d) {
  const v = deepFind(d, ['jwt', 'token', 'addressJwt', 'address_jwt', 'accessToken', 'access_token', 'password']);
  if (typeof v === 'string' && v.trim()) return v.trim();
  const t = typeof d === 'string' ? d : JSON.stringify(d || '');
  const m = t.match(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?\b/);
  return m ? m[0] : '';
}

function qpDecode(t = '') {
  const i = String(t || '').replace(/=\r?\n/g, '');
  const b = i.replace(/=([A-Fa-f0-9]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  try { const d = Buffer.from(b, 'binary').toString('utf8'); return d.includes('\ufffd') ? b : d; } catch { return b; }
}

function mimeDecode(t = '') {
  return String(t || '').replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_, cs, enc, pay) => {
    try {
      if (enc.toUpperCase() === 'B') return Buffer.from(pay, 'base64').toString(cs.toLowerCase().includes('gb') ? 'latin1' : 'utf8');
      return qpDecode(pay.replace(/_/g, ' '));
    } catch { return pay; }
  });
}

function extractCode(t = '') {
  const n = mimeDecode(String(t || ''))
    .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const rx = [
    /(?:verification|verify|confirm(?:ation)?|security|login|one-time|temporary|auth(?:entication)?|code|验证码|校验码|确认码|临时|安全)[^0-9]{0,160}(\d{6})/ig,
    /(\d{3})\s*[\-–— ]\s*(\d{3})/g,
    /\b(\d{6})\b/g,
  ];
  for (const r of rx) {
    const m = [...n.matchAll(r)];
    if (m.length) { const c = m[0].length >= 3 && m[0][1] && m[0][2] ? `${m[0][1]}${m[0][2]}` : (m[0][1] || m[0][0]).replace(/\D/g, ''); if (/^\d{6}$/.test(c)) return c; }
  }
  return '';
}

export function randMbox() { return `dd${Date.now().toString(36)}${randomBytes(3).toString('hex')}`; }

export async function createRegisterMailbox(workerUrl, adminAuth, domain) {
  const name = randMbox();
  const r = await callTempMailAdmin(workerUrl, adminAuth, '/admin/new_address', { method: 'POST', body: { enablePrefix: true, name, domain } });
  const fb = `${name}@${domain}`;
  const email = extractEmailFromResponse(r, fb);
  const jwt = extractJwtFromResponse(r);
  if (!jwt) throw new Error('temp-mail did not return jwt');
  return { email, mailJwt: jwt, provider: 'cloudflare-temp-mail' };
}

export async function waitRegisterCode(workerUrl, mailJwt, waitTimeout = 60, waitInterval = 3) {
  const dl = Date.now() + waitTimeout * 1000;
  while (Date.now() < dl) {
    try {
      const r = await callTempMailMailbox(workerUrl, mailJwt, '/api/mails', { query: { limit: 10, offset: 0 } });
      const items = Array.isArray(r) ? r : (r.items || r.mails || r.messages || []);
      for (const it of items) {
        const raw = it.raw || it.rawText || it.text || it.html || it.content || it.body || JSON.stringify(it);
        const c = extractCode(raw); if (c) return c;
      }
    } catch { }
    await new Promise(r => setTimeout(r, waitInterval * 1000));
  }
  return '';
}
