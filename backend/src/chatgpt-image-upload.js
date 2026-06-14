/**
 * ChatGPT 图片上传辅助模块
 * 提供图片上传到 ChatGPT 文件服务的功能
 */

import { v4 as uuidv4 } from 'uuid';

const CHATGPT_BASE = 'https://chatgpt.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

/**
 * 上传图片到 ChatGPT
 * @param {Buffer} imageData - 图片二进制数据
 * @param {string} fileName - 文件名
 * @param {string} contentType - MIME类型
 * @param {string} accessToken - 访问令牌
 * @param {Function} fetchFn - fetch函数
 * @param {Function} headersFn - 构建请求头函数
 * @returns {Promise<Object>}
 */
export async function uploadImageToChat(imageData, fileName, contentType, accessToken, fetchFn, headersFn) {
  if (!imageData || imageData.length === 0) {
    throw new Error('图片数据不能为空');
  }

  // 获取图片尺寸
  const dimensions = getImageDimensions(imageData);
  if (!dimensions.width || !dimensions.height) {
    throw new Error('无法解析图片尺寸');
  }

  console.log(`📤 上传图片: ${fileName}, 尺寸: ${dimensions.width}x${dimensions.height}, 大小: ${imageData.length} bytes`);

  // 1. 请求上传元数据
  const metadataPath = '/backend-api/files';
  const metadataPayload = {
    file_name: fileName,
    file_size: imageData.length,
    use_case: 'multimodal',
    width: dimensions.width,
    height: dimensions.height
  };

  const metadataResp = await fetchFn(`${CHATGPT_BASE}${metadataPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headersFn(metadataPath)
    },
    body: JSON.stringify(metadataPayload)
  });

  if (!metadataResp.ok) {
    const errorText = await metadataResp.text();
    throw new Error(`获取上传URL失败: ${metadataResp.status} ${errorText}`);
  }

  const uploadMeta = await metadataResp.json();
  const uploadURL = uploadMeta.upload_url;
  const fileId = uploadMeta.file_id;

  if (!uploadURL || !fileId) {
    throw new Error('上传元数据不完整');
  }

  console.log(`✅ 获取上传URL成功, file_id: ${fileId}`);

  // 2. 上传图片到 Azure Blob Storage
  const uploadResp = await fetchFn(uploadURL, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-ms-blob-type': 'BlockBlob',
      'x-ms-version': '2020-04-08',
      'Origin': CHATGPT_BASE,
      'Referer': CHATGPT_BASE + '/',
      'User-Agent': USER_AGENT,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-US;q=0.7'
    },
    body: imageData
  });

  if (!uploadResp.ok) {
    const errorText = await uploadResp.text();
    throw new Error(`上传图片失败: ${uploadResp.status} ${errorText}`);
  }

  console.log(`✅ 图片上传成功`);

  // 3. 轮询检查文件是否就绪
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, 50 * (1 << attempt)));
    }

    const checkPath = `/backend-api/files/${fileId}`;
    try {
      const checkResp = await fetchFn(`${CHATGPT_BASE}${checkPath}`, {
        method: 'HEAD',
        headers: headersFn(checkPath)
      });

      if (checkResp.ok) {
        console.log(`✅ 文件已就绪 (尝试 ${attempt + 1}/5)`);
        break;
      }
    } catch (err) {
      // 继续重试
    }
  }

  // 4. 确认上传完成
  const finalizePath = `/backend-api/files/${fileId}/uploaded`;
  const finalizeResp = await fetchFn(`${CHATGPT_BASE}${finalizePath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headersFn(finalizePath)
    },
    body: '{}'
  });

  if (!finalizeResp.ok) {
    const errorText = await finalizeResp.text();
    throw new Error(`确认上传失败: ${finalizeResp.status} ${errorText}`);
  }

  console.log(`✅ 图片上传流程完成`);

  return {
    fileId,
    fileName,
    fileSize: imageData.length,
    mimeType: contentType,
    width: dimensions.width,
    height: dimensions.height
  };
}

/**
 * 获取图片尺寸
 * @param {Buffer} imageData
 * @returns {Object} {width, height}
 */
function getImageDimensions(imageData) {
  // PNG格式
  if (imageData[0] === 0x89 && imageData[1] === 0x50 && imageData[2] === 0x4E && imageData[3] === 0x47) {
    const width = imageData.readUInt32BE(16);
    const height = imageData.readUInt32BE(20);
    return { width, height };
  }

  // JPEG格式
  if (imageData[0] === 0xFF && imageData[1] === 0xD8) {
    let offset = 2;
    while (offset < imageData.length) {
      if (imageData[offset] !== 0xFF) break;
      const marker = imageData[offset + 1];
      offset += 2;

      // SOF markers
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        const height = imageData.readUInt16BE(offset + 3);
        const width = imageData.readUInt16BE(offset + 5);
        return { width, height };
      }

      const segmentLength = imageData.readUInt16BE(offset);
      offset += segmentLength;
    }
  }

  // WebP格式
  if (imageData[0] === 0x52 && imageData[1] === 0x49 && imageData[2] === 0x46 && imageData[3] === 0x46 &&
      imageData[8] === 0x57 && imageData[9] === 0x45 && imageData[10] === 0x42 && imageData[11] === 0x50) {
    // 简化处理，返回常见尺寸
    return { width: 1024, height: 1024 };
  }

  // 默认值
  console.warn('⚠️ 无法解析图片尺寸，使用默认值');
  return { width: 1024, height: 1024 };
}

/**
 * 构建包含图片的消息内容
 * @param {string} prompt - 文本提示词
 * @param {Array} uploadedImages - 上传后的图片信息数组
 * @returns {Object}
 */
export function buildMultimodalContent(prompt, uploadedImages = []) {
  if (!uploadedImages || uploadedImages.length === 0) {
    return {
      content_type: 'text',
      parts: [prompt]
    };
  }

  const parts = [];

  // 添加图片引用
  for (const img of uploadedImages) {
    parts.push({
      asset_pointer: `file-service://${img.fileId}`,
      size_bytes: img.fileSize,
      width: img.width,
      height: img.height,
      fovea: null,
      metadata: null
    });
  }

  // 添加文本提示词
  parts.push(prompt);

  return {
    content_type: 'multimodal_text',
    parts
  };
}

/**
 * 构建附件列表
 * @param {Array} uploadedImages
 * @returns {Array}
 */
export function buildAttachments(uploadedImages = []) {
  return uploadedImages.map(img => ({
    id: img.fileId,
    name: img.fileName,
    size: img.fileSize,
    width: img.width,
    height: img.height,
    mimeType: img.mimeType
  }));
}
