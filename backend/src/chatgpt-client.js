/**
 * ChatGPT Codex Responses 图片生成客户端 (ESM)
 *
 * 复刻 image 项目 (chatgpt2api) 的 Codex 生图链路:
 *   POST https://chatgpt.com/backend-api/codex/responses
 * 该链路无需 PoW / Sentinel，仅需有效的 access_token 与 Chatgpt-Account-Id。
 * 图片以 base64 直接随 SSE 流返回 (response.output_item.done / response.completed)，
 * 不需要二次下载 file-service:// URL。
 *
 * 参考: internal/backend/responses_image.go (streamCodexResponsesImage)
 */

import { fetch as wreqFetch } from 'wreq-js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { getProxyUrl } from './proxy.js';
import { uploadToR2 } from './r2.js';

// ChatGPT API 配置
const CHATGPT_API_BASE = process.env.CHATGPT_API_BASE || 'https://chatgpt.com';
const CODEX_ENDPOINT = '/backend-api/codex/responses';

// Codex Responses 链路使用的内部模型（对应 responses_image.go 常量）
const RESPONSES_IMAGE_MAIN_MODEL = 'gpt-5.4-mini';
const RESPONSES_IMAGE_TOOL_MODEL = 'gpt-5.4-mini';

// Codex TUI 客户端标识（与上游一致，降低被风控概率）
const CODEX_USER_AGENT = 'codex-tui/0.128.0 (Mac OS 26.3.1; arm64) iTerm.app/3.6.9 (codex-tui; 0.128.0)';
const CODEX_ORIGINATOR = 'codex-tui';

// 尺寸归一化常量
const SIZE_MULTIPLE = 16;
const MAX_EDGE = 3840;
const MAX_RATIO = 3;
const MIN_PIXELS = 655360;
const MAX_PIXELS = 8294400;
const DEFAULT_SIZE = '1024x1024';

const REQUEST_TIMEOUT_MS = 180000;

/**
 * 解码 JWT 风格 access_token 的 payload 段。
 * access_token 可能是不透明字符串，此时返回 null。
 */
function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * 推导 Chatgpt-Account-Id。
 * 优先使用账号记录中显式配置的 chatgpt_account_id，
 * 否则从 access_token JWT 中解析 (https://api.openai.com/auth.chatgpt_account_id)。
 */
export function resolveChatgptAccountId(account) {
  if (!account) return '';
  const explicit = account.chatgpt_account_id || account.account_id;
  if (explicit && String(explicit).trim()) {
    return String(explicit).trim();
  }
  const payload = decodeJwtPayload(account.access_token);
  if (!payload) return '';
  const auth = payload['https://api.openai.com/auth'] || {};
  return (
    payload.chatgpt_account_id ||
    payload.account_id ||
    auth.chatgpt_account_id ||
    ''
  );
}

function roundToMultiple(value) {
  return Math.max(SIZE_MULTIPLE, Math.round(value / SIZE_MULTIPLE) * SIZE_MULTIPLE);
}

function floorToMultiple(value) {
  return Math.max(SIZE_MULTIPLE, Math.floor(value / SIZE_MULTIPLE) * SIZE_MULTIPLE);
}

function ceilToMultiple(value) {
  return Math.max(SIZE_MULTIPLE, Math.ceil(value / SIZE_MULTIPLE) * SIZE_MULTIPLE);
}

/**
 * 将宽高归一化为 16 的倍数，并约束最大边长、宽高比与像素数。
 * 对应 responses_image.go: normalizeResponsesImageDimensions
 */
function normalizeDimensions(width, height) {
  if (width <= 0 || height <= 0) return '';
  let w = roundToMultiple(width);
  let h = roundToMultiple(height);
  for (let i = 0; i < 4; i++) {
    const maxEdge = Math.max(w, h);
    if (maxEdge > MAX_EDGE) {
      const scale = MAX_EDGE / maxEdge;
      w = floorToMultiple(w * scale);
      h = floorToMultiple(h * scale);
    }
    if (w > h * MAX_RATIO) {
      w = floorToMultiple(h * MAX_RATIO);
    } else if (h > w * MAX_RATIO) {
      h = floorToMultiple(w * MAX_RATIO);
    }
    const pixels = w * h;
    if (pixels > MAX_PIXELS) {
      const scale = Math.sqrt(MAX_PIXELS / pixels);
      w = floorToMultiple(w * scale);
      h = floorToMultiple(h * scale);
    } else if (pixels < MIN_PIXELS) {
      const scale = Math.sqrt(MIN_PIXELS / pixels);
      w = ceilToMultiple(w * scale);
      h = ceilToMultiple(h * scale);
    }
  }
  return `${w}x${h}`;
}

function sizeFromRatio(rw, rh) {
  if (rw <= 0 || rh <= 0) return '';
  if (rw === rh) return DEFAULT_SIZE;
  if (rw > rh) return normalizeDimensions(1536, Math.round((1536 * rh) / rw));
  return normalizeDimensions(Math.round((1536 * rw) / rh), 1536);
}

/**
 * 归一化 size / 比例为工具可接受的显式尺寸。
 * 对应 responses_image.go: normalizeResponsesImageToolSize
 */
export function normalizeToolSize(size) {
  let s = String(size || '').toLowerCase().trim();
  s = s.replace(/\s+/g, '').replace(/×/g, 'x');
  if (s === '' || s === 'auto') return '';
  if (s === '1080p') return normalizeDimensions(1080, 1080);
  if (s === '2k') return normalizeDimensions(2048, 2048);
  if (s === '4k') return normalizeDimensions(3840, 3840);

  const dim = s.match(/^(\d+)x(\d+)$/);
  if (dim) {
    const w = parseInt(dim[1], 10);
    const h = parseInt(dim[2], 10);
    if (w < 128 && h < 128) return sizeFromRatio(w, h);
    return normalizeDimensions(w, h);
  }

  const ratio = s.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (ratio) {
    return sizeFromRatio(parseFloat(ratio[1]), parseFloat(ratio[2]));
  }
  return '';
}

function supportsCompression(format) {
  const f = String(format || '').toLowerCase().trim();
  return f === 'jpg' || f === 'jpeg';
}

/**
 * 构建 Codex Responses 生图请求体。
 * 对应 responses_image.go: buildResponsesImagePayload
 */
export function buildCodexPayload(prompt, options = {}) {
  let trimmed = String(prompt || '').trim();
  if (!trimmed) {
    throw new Error('prompt is required');
  }

  // Inject quality and resolution hints into prompt text since Codex tool lacks resolution field
  const hints = [];
  if (options.quality && options.quality !== 'standard') {
    hints.push(options.quality === 'hd' ? '请输出高清质量图片，注重细节和清晰度。' : `请输出 ${options.quality} 质量图片。`);
  }
  if (options.resolution && options.resolution !== '1k') {
    const resMap = { '1k': '1024x1024', '2k': '2048x2048', '4k': '4096x4096', '1080p': '1920x1080' };
    const target = resMap[options.resolution] || options.resolution;
    hints.push(`目标清晰度为 ${target} 级别，尽可能保持高分辨率。`);
  }
  if (hints.length) {
    trimmed = trimmed + '\n\n' + hints.join('\n');
  }

  const tool = {
    type: 'image_generation',
    action: 'generate',
    model: RESPONSES_IMAGE_TOOL_MODEL
  };

  const size = normalizeToolSize(options.size);
  if (size) tool.size = size;

  const passthrough = {
    quality: options.quality,
    background: options.background,
    moderation: options.moderation,
    style: options.style,
    output_format: options.output_format
  };
  for (const [key, value] of Object.entries(passthrough)) {
    if (value && String(value).trim() && String(value).trim() !== 'standard') {
      tool[key] = String(value).trim();
    }
  }

  if (
    Number.isInteger(options.output_compression) &&
    supportsCompression(options.output_format)
  ) {
    tool.output_compression = options.output_compression;
  }
  if (Number.isInteger(options.partial_images) && options.partial_images > 0) {
    tool.partial_images = options.partial_images;
  }

  // Build content array: reference images first, then prompt text
  const content = [];
  const refs = options.reference_images || [];
  for (const ref of refs) {
    if (ref && String(ref).startsWith('data:')) {
      content.push({ type: 'input_image', image_url: { url: ref } });
    } else if (ref && String(ref).startsWith('http')) {
      content.push({ type: 'input_image', image_url: { url: ref } });
    }
  }
  content.push({ type: 'input_text', text: trimmed });

  return {
    model: RESPONSES_IMAGE_MAIN_MODEL,
    input: [
      {
        role: 'user',
        content
      }
    ],
    tools: [tool],
    tool_choice: { type: 'image_generation' },
    instructions: 'You generate and edit images for the user.',
    stream: true,
    store: false,
    parallel_tool_calls: true,
    include: ['reasoning.encrypted_content']
  };
}

function buildHeaders(accessToken, accountId, sessionId) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Chatgpt-Account-Id': accountId,
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'User-Agent': CODEX_USER_AGENT,
    Originator: CODEX_ORIGINATOR,
    Session_id: sessionId,
    Connection: 'Keep-Alive',
    'X-OpenAI-Target-Path': CODEX_ENDPOINT,
    'X-OpenAI-Target-Route': CODEX_ENDPOINT
  };
}

/**
 * 发送 Codex 请求并返回原始 SSE 响应。
 */
async function sendCodexRequest(payload, accessToken, accountId) {
  const url = `${CHATGPT_API_BASE}${CODEX_ENDPOINT}`;
  const sessionId = uuidv4();

  console.log(`🚀 发送 Codex 请求: ${url} (account_id=${accountId})`);

  const response = await wreqFetch(url, {
    method: 'POST',
    headers: buildHeaders(accessToken, accountId, sessionId),
    body: JSON.stringify(payload),
    timeout: REQUEST_TIMEOUT_MS,
    browser: 'chrome_142',
    os: 'windows',
    proxy: getProxyUrl() || undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(
      `Codex 请求失败: ${response.status} ${response.statusText} ${errorText.slice(0, 500)}`
    );
    error.status = response.status;
    throw error;
  }

  return response;
}

function mergeImageItem(item) {
  if (!item || item.type !== 'image_generation_call') return null;
  const b64 = item.result || item.b64_json;
  if (!b64) return null;
  return {
    id: item.id || '',
    b64,
    outputFormat: (item.output_format || 'png').toLowerCase(),
    revisedPrompt: item.revised_prompt || '',
    size: item.size || ''
  };
}

/**
 * 解析 Codex SSE 流，收集完整的图片结果 (base64)。
 * 对应 responses_image.go: iterResponsesImageSSE / parseResponsesImagePayload
 */
async function parseCodexSSEStream(response) {
  const images = [];
  const seen = new Set();
  let buffer = '';
  let streamError = null;

  const addImage = (img) => {
    if (!img) return;
    const key = img.id || img.b64.slice(0, 64);
    if (seen.has(key)) return;
    seen.add(key);
    images.push(img);
  };

  const handlePayload = (dataStr) => {
    if (!dataStr || dataStr === '[DONE]') return;
    let data;
    try {
      data = JSON.parse(dataStr);
    } catch {
      return;
    }

    switch (data.type) {
      case 'response.output_item.done':
        addImage(mergeImageItem(data.item));
        break;
      case 'response.completed': {
        const output = data.response?.output;
        if (Array.isArray(output)) {
          for (const item of output) {
            addImage(mergeImageItem(item));
          }
        }
        break;
      }
      case 'error': {
        const message =
          data.message || data.error?.message || 'Codex responses 返回错误';
        streamError = new Error(message);
        break;
      }
      default:
        break;
    }
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('SSE 流超时'));
    }, REQUEST_TIMEOUT_MS);

    const nodeStream = Readable.fromWeb(response.body);
    nodeStream.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        handlePayload(trimmed.slice(5).trim());
      }
    });

    nodeStream.on('end', () => {
      clearTimeout(timer);
      if (buffer.trim().startsWith('data:')) {
        handlePayload(buffer.trim().slice(5).trim());
      }
      if (streamError) {
        reject(streamError);
        return;
      }
      resolve(images);
    });

    nodeStream.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function extensionForFormat(format) {
  switch (String(format || '').toLowerCase()) {
    case 'jpeg':
    case 'jpg':
      return 'jpg';
    case 'webp':
      return 'webp';
    default:
      return 'png';
  }
}

/**
 * 将 base64 图片上传到 R2，返回公共 URL。
 */
async function saveBase64Image(b64, format, _uploadDir, index) {
  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length === 0) {
    throw new Error('解码后的图片数据为空');
  }
  const ext = extensionForFormat(format);
  const filename = `${Date.now()}_${index}_${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  const url = await uploadToR2(buffer, filename, mime);
  console.log(`✅ 图片已上传 R2: ${url} (${buffer.length} bytes)`);
  return url;
}

/**
 * 主函数：通过 Codex Responses 链路生成图片。
 * @param {string} prompt - 提示词
 * @param {object} account - 账号信息 {access_token, email, chatgpt_account_id?}
 * @param {object} options - 生成选项 {model, size, quality, output_format, ...}
 * @param {string} uploadDir - 图片保存目录 (绝对路径)
 * @returns {Promise<Array<{url:string, revisedPrompt:string, outputFormat:string}>>}
 */
async function urlToBase64DataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = path.extname(new URL(url).pathname).toLowerCase().replace('.', '') || 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/png';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch (e) {
    console.error('读取参考图失败:', url, e.message);
    return null;
  }
}

function fileToBase64DataUrl(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/png';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch (e) {
    console.error('读取参考图失败:', filePath, e.message);
    return null;
  }
}

export async function generateImage(prompt, account, options = {}, uploadDir = 'uploads') {
  const { model = 'gpt-image-2', size = 'auto', quality = '' } = options;

  console.log('\n========================================');
  console.log('🎨 开始生成图片 (Codex Responses)');
  console.log(`📝 提示词: ${String(prompt).slice(0, 80)}`);
  console.log(`🔑 账号: ${account?.email}`);
  console.log(`⚙️  参数: model=${model}, size=${size}, quality=${quality || '默认'}`);
  console.log('========================================\n');

  if (!account || !account.access_token) {
    throw new Error('账号缺少 access_token');
  }

  const accountId = resolveChatgptAccountId(account);
  if (!accountId) {
    throw new Error(
      '无法获取 Chatgpt-Account-Id：access_token 不是有效 JWT 或缺少账号信息，请确认 token 为 ChatGPT 网页会话 token'
    );
  }

  // Convert reference images (URL or local path) to base64 data URLs
  const referenceImages = [];
  if (Array.isArray(options.reference_images)) {
    for (const refPath of options.reference_images) {
      if (!refPath) continue;
      let b64 = null;
      if (refPath.startsWith('http')) {
        b64 = await urlToBase64DataUrl(refPath);
      } else {
        const absolutePath = refPath.startsWith('/') ? path.join(process.cwd(), refPath) : refPath;
        b64 = fileToBase64DataUrl(absolutePath);
      }
      if (b64) referenceImages.push(b64);
    }
  }

  const payload = buildCodexPayload(prompt, {
    size,
    quality,
    output_format: options.output_format,
    output_compression: options.output_compression,
    background: options.background,
    style: options.style,
    moderation: options.moderation,
    partial_images: options.partial_images,
    resolution: options.resolution,
    reference_images: referenceImages
  });

  const response = await sendCodexRequest(payload, account.access_token, accountId);
  const images = await parseCodexSSEStream(response);

  if (images.length === 0) {
    throw new Error('未从 Codex 响应中获取到图片数据（可能账号无生图权限或返回了文本回复）');
  }

  const results = await Promise.all(images.map(async (img, index) => ({
    url: await saveBase64Image(img.b64, img.outputFormat, uploadDir, index),
    revisedPrompt: img.revisedPrompt,
    outputFormat: extensionForFormat(img.outputFormat)
  })));

  console.log(`\n✅ 图片生成成功，共 ${results.length} 张\n`);
  return results;
}

export default {
  generateImage,
  buildCodexPayload,
  normalizeToolSize,
  resolveChatgptAccountId
};
