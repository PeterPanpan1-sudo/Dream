import { randomBytes, randomUUID, createHash } from 'crypto';

const SENTINEL_BASE = 'https://sentinel.openai.com';
const SENTINEL_SDK = SENTINEL_BASE + '/sentinel/20260124ceb8/sdk.js';
const SENTINEL_MAX = 500000;
const SENTINEL_ERR = 'wQ8Lk5FbGpA2NcR9dShT6gYjU7VxZ4D';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

function fnv1a32(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0).toString(16).padStart(8, '0');
}

function b64json(v) { return Buffer.from(JSON.stringify(v), 'utf8').toString('base64'); }

function uuid() { return crypto.randomUUID(); }

export class SentinelGen {
  constructor(deviceID, userAgent = UA) {
    this.deviceID = deviceID;
    this.userAgent = userAgent;
    this.sid = uuid();
  }
  config() {
    const pn = 1000 + Math.random() * 49000;
    return [
      '1920x1080',
      new Date().toUTCString().replace('GMT', 'GMT+0000').replace('UTC', 'Coordinated Universal Time'),
      4294705152,
      Math.random(),
      this.userAgent,
      SENTINEL_SDK,
      null, null,
      'en-US',
      Math.random(),
      pick(['vendorSub-undefined', 'plugins-undefined', 'mimeTypes-undefined', 'hardwareConcurrency-undefined']),
      pick(['location', 'implementation', 'URL', 'documentURI', 'compatMode']),
      pick(['Object', 'Function', 'Array', 'Number', 'parseFloat', 'undefined']),
      pn,
      this.sid,
      '',
      pick([4, 8, 12, 16]),
      Date.now() - pn,
    ];
  }
  reqToken() {
    const d = this.config();
    d[3] = 1;
    d[9] = Math.round(5 + Math.random() * 45);
    return 'gAAAAAC' + b64json(d);
  }
  solve(seed, difficulty = '0') {
    const s = Date.now();
    const d = this.config();
    for (let i = 0; i < SENTINEL_MAX; i++) {
      d[3] = i;
      d[9] = Math.round(Date.now() - s);
      const p = b64json(d);
      const h = fnv1a32(seed + p);
      const pl = Math.min(difficulty.length, h.length);
      if (h.slice(0, pl) <= difficulty.slice(0, pl)) return 'gAAAAAB' + p + '~S';
    }
    return 'gAAAAAB' + SENTINEL_ERR + b64json('None');
  }
}

export function sentinelHeaders() {
  return {
    'Content-Type': 'text/plain;charset=UTF-8',
    'Referer': SENTINEL_BASE + '/backend-api/sentinel/frame.html',
    'Origin': SENTINEL_BASE,
    'User-Agent': UA,
    'sec-ch-ua': '"Google Chrome";v="145", "Not?A_Brand";v="8", "Chromium";v="145"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  };
}

export function traceHeaders() {
  const tid = randomBytes(16).toString('hex');
  const pid = BigInt.asUintN(64, BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)));
  const ph = Number(pid).toString(16).padStart(16, '0');
  const pt = pid.toString();
  return {
    traceparent: `00-${tid}-${ph}-01`,
    tracestate: 'dd=s:1;o:rum',
    'x-datadog-origin': 'rum',
    'x-datadog-parent-id': pt,
    'x-datadog-sampling-priority': '1',
    'x-datadog-trace-id': String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
  };
}

export function randTokenURL(n) {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let s = '';
  const b = randomBytes(n);
  for (let i = 0; i < n; i++) s += c[b[i] % c.length];
  return s;
}

export { SENTINEL_BASE };
