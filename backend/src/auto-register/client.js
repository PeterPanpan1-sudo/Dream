import { randomBytes } from 'crypto';
import HttpsProxyAgent from 'https-proxy-agent';
import fetch from 'node-fetch';

const AUTH_BASE = 'https://auth.openai.com';
const PLATFORM_BASE = 'https://platform.openai.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const SEC_CH_UA = '"Google Chrome";v="145", "Not?A_Brand";v="8", "Chromium";v="145"';
const FULL_VER = '"Chromium";v="145.0.0.0", "Not:A-Brand";v="99.0.0.0", "Google Chrome";v="145.0.0.0"';

class CookieJar {
  constructor() { this.jar = new Map(); }
  set(h) { if (!h) return; const [kv] = h.split(';'); const [n, v] = kv.trim().split('='); if (n) this.jar.set(n.trim(), kv.trim()); }
  get() { return Array.from(this.jar.values()).join('; '); }
  clear() { this.jar.clear(); }
  has(name) { return this.jar.has(name); }
}

export class RegisterHTTPClient {
  constructor(proxy, timeout = 60000, deviceID) {
    this.jar = new CookieJar();
    this.deviceID = deviceID;
    this.proxy = (proxy || '').trim();
    this.timeout = timeout;
    this.agent = this.proxy ? new HttpsProxyAgent(this.proxy) : undefined;
    this.jar.jar.set('oai-did', { name: 'oai-did', value: deviceID, raw: `oai-did=${deviceID}` });
  }

  _cookie() { return this.jar.get(); }

  navHdr(referer, isFirstVisit = false) {
    const h = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': UA,
      'sec-ch-ua': SEC_CH_UA,
      'sec-ch-ua-arch': '"x86"',
      'sec-ch-ua-bitness': '"64"',
      'sec-ch-ua-full-version-list': FULL_VER,
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-model': '""',
      'sec-ch-ua-platform': '"Windows"',
      'sec-ch-ua-platform-version': '"15.0.0"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': isFirstVisit ? 'none' : (referer ? 'same-origin' : 'cross-site'),
      'sec-fetch-user': '?1',
    };
    const cookie = this._cookie();
    if (cookie) h['Cookie'] = cookie;
    if (referer) h['Referer'] = referer;
    return h;
  }

  jsonHdr(referer) {
    const { traceparent, tracestate, 'x-datadog-origin': xdo, 'x-datadog-parent-id': xdpi,
      'x-datadog-sampling-priority': xdsp, 'x-datadog-trace-id': xdti } = this._trace();
    const h = {
      'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9',
      'Content-Type': 'application/json', 'Origin': AUTH_BASE, 'priority': 'u=1, i',
      'User-Agent': UA, 'oai-device-id': this.deviceID, 'sec-ch-ua': SEC_CH_UA,
      'sec-ch-ua-arch': '"x86_64"', 'sec-ch-ua-bitness': '"64"',
      'sec-ch-ua-full-version-list': FULL_VER, 'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-model': '""', 'sec-ch-ua-platform': '"Windows"',
      'sec-ch-ua-platform-version': '"10.0.0"', 'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin',
      traceparent, tracestate, 'x-datadog-origin': xdo,
      'x-datadog-parent-id': xdpi, 'x-datadog-sampling-priority': xdsp,
      'x-datadog-trace-id': xdti, 'Cookie': this._cookie(),
    };
    if (referer) h['Referer'] = referer;
    return h;
  }

  _trace() {
    const tid = randomBytes(16).toString('hex');
    const pid = BigInt.asUintN(64, BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)));
    const ph = Number(pid).toString(16).padStart(16, '0');
    const pt = pid.toString();
    return {
      traceparent: `00-${tid}-${ph}-01`, tracestate: 'dd=s:1;o:rum',
      'x-datadog-origin': 'rum', 'x-datadog-parent-id': pt,
      'x-datadog-sampling-priority': '1',
      'x-datadog-trace-id': String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
    };
  }

  sentinelHdr() {
    return {
      'Content-Type': 'text/plain;charset=UTF-8',
      'Referer': 'https://sentinel.openai.com/backend-api/sentinel/frame.html',
      'Origin': 'https://sentinel.openai.com', 'User-Agent': UA,
      'sec-ch-ua': SEC_CH_UA, 'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"Windows"',
      'Cookie': this._cookie(),
    };
  }

  async request(method, target, payload, extra = {}, follow = true) {
    const body = payload ? JSON.stringify(payload) : undefined;
    const headers = { ...this.jsonHdr(), ...extra };
    let last;
    for (let a = 0; a < 3; a++) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), this.timeout);
        const res = await fetch(target, { method, headers, body, redirect: follow ? 'follow' : 'manual', signal: ctrl.signal, agent: this.agent });
        clearTimeout(t);
        const raw = (res.headers.raw?.()['set-cookie']) || [];
        for (const c of raw) this.jar.set(c);
        const txt = await res.text();
        let data = {};
        try { data = JSON.parse(txt); } catch { if (txt) data = { body: txt }; }
        return { status: res.status, data, headers: res.headers };
      } catch (e) { last = e; if (a < 2) await new Promise(r => setTimeout(r, 1000)); }
    }
    throw last || new Error('request failed');
  }

  async form(target, formData) {
    const body = formData.toString();
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'User-Agent': UA, 'Cookie': this._cookie() };
    let last;
    for (let a = 0; a < 3; a++) {
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), this.timeout);
        const res = await fetch(target, { method: 'POST', headers, body, signal: ctrl.signal, agent: this.agent });
        clearTimeout(t);
        const raw = (res.headers.raw?.()['set-cookie']) || [];
        for (const c of raw) this.jar.set(c);
        let data = {}; try { data = await res.json(); } catch { }
        return { status: res.status, data };
      } catch (e) { last = e; if (a < 2) await new Promise(r => setTimeout(r, 1000)); }
    }
    throw last || new Error('form failed');
  }

  async raw(method, target, body, extra = {}) {
    let last;
    for (let a = 0; a < 3; a++) {
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), this.timeout);
        const res = await fetch(target, { method, headers: { ...this.sentinelHdr(), ...extra }, body, signal: ctrl.signal, agent: this.agent });
        clearTimeout(t);
        const raw = (res.headers.raw?.()['set-cookie']) || [];
        for (const c of raw) this.jar.set(c);
        let data = {}; try { data = await res.json(); } catch { }
        return { status: res.status, data };
      } catch (e) { last = e; if (a < 2) await new Promise(r => setTimeout(r, 1000)); }
    }
    throw last || new Error('raw failed');
  }

  async navigate(target, extra = {}, isFirstVisit = false) {
    let last;
    for (let a = 0; a < 3; a++) {
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), this.timeout);
        const res = await fetch(target, { method: 'GET', headers: { ...this.navHdr(null, isFirstVisit), ...extra }, redirect: 'manual', signal: ctrl.signal, agent: this.agent });
        clearTimeout(t);
        const raw = (res.headers.raw?.()['set-cookie']) || [];
        for (const c of raw) this.jar.set(c);
        return { status: res.status, headers: res.headers, url: res.url };
      } catch (e) { last = e; if (a < 2) await new Promise(r => setTimeout(r, 1000)); }
    }
    throw last || new Error('navigate failed');
  }

  async navGet(target, referer, follow = true) {
    let last;
    for (let a = 0; a < 3; a++) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), this.timeout);
        const res = await fetch(target, { method: 'GET', headers: this.navHdr(referer), redirect: follow ? 'follow' : 'manual', signal: ctrl.signal, agent: this.agent });
        clearTimeout(t);
        const raw = (res.headers.raw?.()['set-cookie']) || [];
        for (const c of raw) this.jar.set(c);
        const txt = await res.text();
        let data = {};
        try { data = JSON.parse(txt); } catch { if (txt) data = { body: txt }; }
        return { status: res.status, data, headers: res.headers };
      } catch (e) { last = e; if (a < 2) await new Promise(r => setTimeout(r, 1000)); }
    }
    throw last || new Error('navGet failed');
  }

  clear() { this.jar.clear(); this.jar.jar.set('oai-did', { name: 'oai-did', value: this.deviceID, raw: `oai-did=${this.deviceID}` }); }
}

export { AUTH_BASE, PLATFORM_BASE, UA, SEC_CH_UA, FULL_VER };
