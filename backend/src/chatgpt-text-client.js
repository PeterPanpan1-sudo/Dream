import { createSession } from 'wreq-js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Readable } from 'stream';
import { getProxyUrl } from './proxy.js';
import { resolveChatgptAccountId } from './chatgpt-client.js';

const CHATGPT_API_BASE = process.env.CHATGPT_API_BASE || 'https://chatgpt.com';
const PREPARE_PATH = '/backend-api/f/conversation/prepare';
const STREAM_PATH = '/backend-api/f/conversation';
const DEFAULT_POW_SCRIPT = 'https://chatgpt.com/backend-api/sentinel/sdk.js';
const CLIENT_VERSION = 'prod-be885abbfcfe7b1f511e88b3003d9ee44757fbad';
const CLIENT_BUILD_NUMBER = '5955942';
const REQUEST_TIMEOUT_MS = 300000;
const FIRST_TEXT_TIMEOUT_MS = 60000;
const STREAM_IDLE_TIMEOUT_MS = 45000;

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';
const SEC_CH_UA = '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"';

const NAVIGATOR_KEYS = [
  'registerProtocolHandler−function registerProtocolHandler() { [native code] }',
  'storage−[object StorageManager]',
  'locks−[object LockManager]',
  'appCodeName−Mozilla',
  'permissions−[object Permissions]',
  'share−function share() { [native code] }',
  'webdriver−false',
  'vendor−Google Inc.',
  'mediaDevices−[object MediaDevices]',
  'cookieEnabled−true',
  'language−zh-CN',
  'hardwareConcurrency−32'
];
const WINDOW_KEYS = [
  'window', 'self', 'document', 'location', 'history', 'navigation', 'screen', 'chrome',
  'navigator', 'performance', 'crypto', 'indexedDB', 'sessionStorage', 'localStorage', 'fetch'
];
const DOCUMENT_KEYS = ['_reactListeningo743lnnpvdg', 'location'];

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)] || '';
}

function parsePowResources(html) {
  const sources = [];
  let dataBuild = '';
  const scriptRe = /<script[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = scriptRe.exec(html)) !== null) {
    const src = match[1];
    sources.push(src);
    if (!dataBuild) {
      const hit = /c\/[^/]*\/_/.exec(src);
      if (hit) dataBuild = hit[0];
    }
  }
  if (!dataBuild) {
    const m = /<html[^>]*data-build=["']([^"']*)["']/.exec(html);
    if (m) dataBuild = m[1];
  }
  if (sources.length === 0) sources.push(DEFAULT_POW_SCRIPT);
  return { sources, dataBuild };
}

function buildPowConfig(userAgent, scriptSources, dataBuild) {
  const nowMs = Date.now();
  const estDate = new Date().toString().replace(/GMT.*$/, '') + 'GMT-0500 (Eastern Standard Time)';
  return [
    randomChoice([3000, 4000, 5000]),
    estDate,
    4294705152,
    0,
    userAgent,
    randomChoice(scriptSources && scriptSources.length ? scriptSources : [DEFAULT_POW_SCRIPT]),
    dataBuild,
    'en-US',
    'en-US,es-US,en,es',
    0,
    randomChoice(NAVIGATOR_KEYS),
    randomChoice(DOCUMENT_KEYS),
    randomChoice(WINDOW_KEYS),
    nowMs,
    uuidv4(),
    '',
    randomChoice([8, 16, 24, 32]),
    0
  ];
}

function powGenerate(seed, difficulty, config, limit) {
  const target = Buffer.from(difficulty, 'hex');
  const diffLen = target.length > 0 ? target.length : 3;
  const seedBytes = Buffer.from(seed, 'utf8');
  let part1 = JSON.stringify(config.slice(0, 3));
  part1 = part1.slice(0, -1) + ',';
  let part2 = JSON.stringify(config.slice(4, 9));
  part2 = ',' + part2.slice(1, -1) + ',';
  let part3 = JSON.stringify(config.slice(10));
  part3 = ',' + part3.slice(1);
  for (let i = 0; i < limit; i++) {
    const finalJSON = part1 + i + part2 + (i >> 1) + part3;
    const encoded = Buffer.from(finalJSON, 'utf8').toString('base64');
    const hash = crypto
      .createHash('sha3-512')
      .update(Buffer.concat([seedBytes, Buffer.from(encoded, 'utf8')]))
      .digest();
    if (Buffer.compare(hash.subarray(0, diffLen), target) <= 0) {
      return { answer: encoded };
    }
  }
  return { answer: 'wQ8Lk5FbGpA2NcR9dShT6gYjU7VxZ4D' + Buffer.from('"' + seed + '"', 'utf8').toString('base64') };
}

function buildLegacyRequirementsToken(userAgent, scriptSources, dataBuild) {
  const seed = Math.random().toFixed(6);
  const config = buildPowConfig(userAgent, scriptSources, dataBuild);
  const { answer } = powGenerate(seed, '0fffff', config, 500000);
  return 'gAAAAAC' + answer;
}

function buildProofToken(seed, difficulty, userAgent, scriptSources, dataBuild) {
  const config = buildPowConfig(userAgent, scriptSources, dataBuild);
  const { answer } = powGenerate(seed, difficulty || '0fffff', config, 500000);
  return 'gAAAAAB' + answer;
}

function httpError(context, status, body) {
  const error = new Error(`文字链路 ${context} 失败: ${status} ${String(body || '').slice(0, 300)}`);
  error.status = status;
  return error;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function streamTimeoutError(message) {
  const error = new Error(message);
  error.status = 504;
  return error;
}

function buildTextContent(text) {
  return {
    content_type: 'text',
    parts: [String(text || '').trim()]
  };
}

function textModelSlug(model) {
  const value = String(model || '').trim();
  if (!value || value === 'gpt-5.5') return 'gpt-5-5';
  return 'gpt-5-5';
}

function textFromParts(parts) {
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object') {
        if (typeof part.text === 'string') return part.text;
        if (typeof part.content === 'string') return part.content;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function messageTextFromValue(value) {
  if (!value || typeof value !== 'object') return '';
  const message = value.message && typeof value.message === 'object' ? value.message : value;
  const author = message.author || {};
  const role = String(author.role || '').toLowerCase();
  if (role && role !== 'assistant') return '';
  const content = message.content || {};
  const fromParts = textFromParts(content.parts);
  if (fromParts) return fromParts;
  if (typeof content.text === 'string') return content.text.trim();
  return '';
}

function isAssistantContentPath(path) {
  const normalized = String(path || '');
  return /\/message\/content\/parts(?:\/\d+)?(?:$|\/)/.test(normalized)
    || /\/message\/content\/text(?:$|\/)/.test(normalized);
}

function textFromPatchValue(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return textFromParts(value);
  if (value && typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (typeof value.content === 'string') return value.content;
    if (Array.isArray(value.parts)) return textFromParts(value.parts);
  }
  return '';
}

function extractAssistantPatch(event) {
  const readPatch = (value) => {
    if (!value || typeof value !== 'object') return null;
    if (Array.isArray(value)) {
      const items = value.map(readPatch).filter(Boolean);
      if (items.length === 0) return null;
      return {
        text: items.map((item) => item.text).join(''),
        append: items.every((item) => item.append)
      };
    }
    const path = value.p || value.path;
    if (!isAssistantContentPath(path)) return null;
    const text = textFromPatchValue(value.v ?? value.value);
    if (!text) return null;
    const op = String(value.o || value.op || '').toLowerCase();
    return { text, append: !op || op === 'append' };
  };

  for (const candidate of [event, event && event.v]) {
    const patch = readPatch(candidate);
    if (patch && patch.text) return patch;
  }
  return null;
}

function extractAssistantText(event) {
  for (const candidate of [event, event && event.v]) {
    const text = messageTextFromValue(candidate);
    if (text) return text;
  }
  return '';
}

function extractConversationId(payload, event) {
  const raw = String(payload || '');
  const match = raw.match(/"conversation_id"\s*:\s*"([^"]+)"/);
  if (match) return match[1];
  for (const candidate of [event, event && event.v]) {
    if (candidate && typeof candidate === 'object' && typeof candidate.conversation_id === 'string') {
      return candidate.conversation_id;
    }
  }
  return '';
}

function extractTextFromConversation(data) {
  const mapping = data && typeof data.mapping === 'object' ? data.mapping : {};
  let assistantText = '';
  for (const node of Object.values(mapping)) {
    const message = node && node.message ? node.message : null;
    if (!message) continue;
    const author = message.author || {};
    const role = String(author.role || '').toLowerCase();
    if (role !== 'assistant') continue;
    const text = extractAssistantText({ message });
    if (text) assistantText = text;
  }
  return assistantText;
}

class ChatGPTTextClient {
  constructor(account) {
    this.accessToken = String(account?.session_token || account?.access_token || '').trim();
    this.accountId = resolveChatgptAccountId(account);
    this.deviceId = uuidv4();
    this.sessionId = uuidv4();
    this.proxyUrl = getProxyUrl();
    this.powSources = [DEFAULT_POW_SCRIPT];
    this.powDataBuild = '';
    this.session = null;
  }

  async ensureSession() {
    if (this.session) return;
    const opts = this.proxyUrl ? { proxy: this.proxyUrl } : {};
    this.session = await createSession(opts);
  }

  async closeSession() {
    if (this.session && typeof this.session.close === 'function') await this.session.close();
    this.session = null;
  }

  commonHeaders(targetPath, extra = {}) {
    const headers = {
      'User-Agent': BROWSER_USER_AGENT,
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Sec-Ch-Ua': SEC_CH_UA,
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      Origin: CHATGPT_API_BASE,
      Referer: CHATGPT_API_BASE + '/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'OAI-Device-Id': this.deviceId,
      'OAI-Session-Id': this.sessionId,
      'OAI-Language': 'zh-CN',
      'OAI-Client-Version': CLIENT_VERSION,
      'OAI-Client-Build-Number': CLIENT_BUILD_NUMBER,
      'X-OpenAI-Target-Path': targetPath,
      'X-OpenAI-Target-Route': targetPath
    };
    if (this.accessToken) headers.Authorization = 'Bearer ' + this.accessToken;
    if (this.accountId) headers['Chatgpt-Account-Id'] = this.accountId;
    return { ...headers, ...extra };
  }

  officialHeaders(targetPath, reqs, conduitToken, accept) {
    const extra = {
      'Content-Type': 'application/json',
      Accept: accept,
      'OpenAI-Sentinel-Chat-Requirements-Token': reqs.token
    };
    if (reqs.proofToken) extra['OpenAI-Sentinel-Proof-Token'] = reqs.proofToken;
    if (reqs.soToken) extra['OpenAI-Sentinel-SO-Token'] = reqs.soToken;
    if (conduitToken) extra['X-Conduit-Token'] = conduitToken;
    if (accept === 'text/event-stream') extra['X-Oai-Turn-Trace-Id'] = uuidv4();
    return this.commonHeaders(targetPath, extra);
  }

  async fetchUpstream(url, options = {}) {
    await this.ensureSession();
    return await this.session.fetch(url, { timeout: REQUEST_TIMEOUT_MS, ...options });
  }

  async bootstrap() {
    const response = await this.fetchUpstream(CHATGPT_API_BASE + '/', {
      method: 'GET',
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Sec-Ch-Ua': SEC_CH_UA,
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    const html = await response.text();
    if (!response.ok) throw httpError('bootstrap', response.status, html);
    const parsed = parsePowResources(html);
    this.powSources = parsed.sources;
    this.powDataBuild = parsed.dataBuild;
  }

  async getChatRequirements() {
    const targetPath = '/backend-api/sentinel/chat-requirements';
    const p = buildLegacyRequirementsToken(BROWSER_USER_AGENT, this.powSources, this.powDataBuild);
    const response = await this.fetchUpstream(CHATGPT_API_BASE + targetPath, {
      method: 'POST',
      headers: this.commonHeaders(targetPath, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ p })
    });
    const text = await response.text();
    if (!response.ok) throw httpError('chat_requirements', response.status, text);
    const data = JSON.parse(text);
    if (data.arkose && data.arkose.required) throw new Error('上游要求 Arkose 验证码，文字链路暂不支持');
    let proofToken = '';
    if (data.proofofwork && data.proofofwork.required) {
      proofToken = buildProofToken(data.proofofwork.seed, data.proofofwork.difficulty, BROWSER_USER_AGENT, this.powSources, this.powDataBuild);
    }
    if (!data.token) throw new Error('sentinel 未返回 chat-requirements token');
    return { token: data.token, proofToken, soToken: data.so_token || '' };
  }

  async prepareConversation(prompt, reqs, model) {
    const payload = {
      action: 'next',
      fork_from_shared_post: false,
      parent_message_id: uuidv4(),
      model: textModelSlug(model),
      client_prepare_state: 'success',
      timezone_offset_min: -480,
      timezone: 'Asia/Shanghai',
      conversation_mode: { kind: 'primary_assistant' },
      partial_query: {
        id: uuidv4(),
        author: { role: 'user' },
        content: buildTextContent(prompt)
      },
      supports_buffering: true,
      supported_encodings: ['v1'],
      client_contextual_info: { app_name: 'chatgpt.com' }
    };
    const response = await this.fetchUpstream(CHATGPT_API_BASE + PREPARE_PATH, {
      method: 'POST',
      headers: this.officialHeaders(PREPARE_PATH, reqs, '', '*/*'),
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    if (!response.ok) throw httpError('prepare', response.status, text);
    try {
      return JSON.parse(text).conduit_token || '';
    } catch {
      return '';
    }
  }

  async startConversation(prompt, reqs, conduitToken, model) {
    const message = {
      id: uuidv4(),
      author: { role: 'user' },
      create_time: Date.now() / 1000,
      content: buildTextContent(prompt),
      metadata: {
        developer_mode_connector_ids: [],
        selected_github_repos: [],
        selected_all_github_repos: false,
        serialization_metadata: { custom_symbol_offsets: [] }
      }
    };
    const payload = {
      action: 'next',
      messages: [message],
      parent_message_id: uuidv4(),
      model: textModelSlug(model),
      client_prepare_state: 'sent',
      timezone_offset_min: -480,
      timezone: 'Asia/Shanghai',
      conversation_mode: { kind: 'primary_assistant' },
      enable_message_followups: true,
      supports_buffering: true,
      supported_encodings: ['v1'],
      paragen_cot_summary_display_override: 'allow',
      force_parallel_switch: 'auto',
      client_contextual_info: {
        is_dark_mode: true,
        time_since_loaded: 1200,
        page_height: 1072,
        page_width: 1724,
        pixel_ratio: 1.2,
        screen_height: 1440,
        screen_width: 2560,
        app_name: 'chatgpt.com'
      }
    };
    const response = await this.fetchUpstream(CHATGPT_API_BASE + STREAM_PATH, {
      method: 'POST',
      headers: this.officialHeaders(STREAM_PATH, reqs, conduitToken, 'text/event-stream'),
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const text = await response.text();
      throw httpError('f/conversation', response.status, text);
    }
    return response;
  }

  async pollConversationText(conversationId) {
    if (!conversationId) return '';
    const targetPath = '/backend-api/conversation/' + conversationId;
    let delay = 1000;
    for (let attempt = 0; attempt < 10; attempt++) {
      if (attempt > 0) await sleep(delay);
      const response = await this.fetchUpstream(CHATGPT_API_BASE + targetPath, {
        method: 'GET',
        headers: this.commonHeaders(targetPath, { Accept: 'application/json' })
      });
      if (response.status === 429) {
        delay = Math.min(delay * 2, 8000);
        continue;
      }
      const text = await response.text();
      if (!response.ok) throw httpError('conversation', response.status, text);
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        delay = Math.min(delay * 2, 8000);
        continue;
      }
      const result = extractTextFromConversation(data);
      if (result) return result;
      delay = Math.min(delay * 2, 8000);
    }
    return '';
  }

  async streamText(prompt, options, onDelta) {
    await this.bootstrap();
    const reqs = await this.getChatRequirements();
    const conduitToken = await this.prepareConversation(prompt, reqs, options.model);
    const response = await this.startConversation(prompt, reqs, conduitToken, options.model);
    const nodeStream = Readable.fromWeb(response.body);
    let buffer = '';
    let lastText = '';
    let conversationId = '';
    let firstTextTimer = null;
    let idleTimer = null;

    const clearFirstTextTimer = () => {
      if (firstTextTimer) clearTimeout(firstTextTimer);
      firstTextTimer = null;
    };
    const clearIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
    };
    const refreshIdleTimer = () => {
      clearIdleTimer();
      idleTimer = setTimeout(() => {
        nodeStream.destroy(streamTimeoutError('文字链路长时间没有返回数据，请稍后重试'));
      }, STREAM_IDLE_TIMEOUT_MS);
    };
    const armFirstTextTimer = () => {
      clearFirstTextTimer();
      firstTextTimer = setTimeout(() => {
        nodeStream.destroy(streamTimeoutError('文字链路长时间没有返回有效文本，请稍后重试'));
      }, FIRST_TEXT_TIMEOUT_MS);
    };

    const appendText = (text) => {
      if (!text) return;
      clearFirstTextTimer();
      if (text.startsWith(lastText)) {
        const delta = text.slice(lastText.length);
        if (delta) onDelta(delta, text);
      } else if (text !== lastText) {
        onDelta(text, text);
      }
      lastText = text;
    };

    const ingest = (payload) => {
      const data = payload.trim();
      if (!data || data === '[DONE]') return;
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        const id = extractConversationId(data, null);
        if (id) conversationId = id;
        return;
      }
      const id = extractConversationId(data, event);
      if (id) conversationId = id;
      if (event.type === 'error') {
        const message = event.message || (event.error && event.error.message) || '文字链路返回错误';
        throw new Error(message);
      }
      const text = extractAssistantText(event);
      if (!text) return;
      appendText(text);
    };

    armFirstTextTimer();
    refreshIdleTimer();
    try {
      for await (const chunk of nodeStream) {
        refreshIdleTimer();
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) ingest(trimmed.slice(5));
        }
      }
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data:')) ingest(trimmed.slice(5));
      clearFirstTextTimer();
      const fallbackText = await this.pollConversationText(conversationId);
      if (fallbackText) appendText(fallbackText);
      if (!lastText) throw streamTimeoutError('文字链路没有返回有效文本，请稍后重试');
      return lastText;
    } finally {
      clearFirstTextTimer();
      clearIdleTimer();
    }
  }
}

export async function streamText(prompt, account, options = {}, onDelta = () => {}) {
  const client = new ChatGPTTextClient(account);
  try {
    return await client.streamText(prompt, options, onDelta);
  } finally {
    await client.closeSession();
  }
}

export default { streamText };
