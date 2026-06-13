# 图片生成流程分析与改进方案

## ✅ 实施状态（2026-06-13 更新）

**已完成方案 A 的完整实现！**

### 已实现功能：

1. ✅ **数据库增强** - 添加了完整的 token 字段
   - `access_token` - ChatGPT 访问令牌
   - `refresh_token` - 刷新令牌
   - `expires_at` - 过期时间
   - `used_count` - 使用次数统计
   - `last_used_at` - 最后使用时间

2. ✅ **前端表单更新** - 支持输入 access_token
   - 添加 access_token 输入框（必填）
   - 添加 refresh_token 输入框（可选）
   - 表格显示 token 状态和使用次数
   - Token 脱敏显示（仅显示前12位）

3. ✅ **ChatGPT API 调用** - 完整实现
   - 从账号池获取可用账号
   - 使用 Bearer Token 认证
   - 调用 `https://chatgpt.com/backend-api/conversation`
   - 解析 SSE 流式响应

4. ✅ **账号轮询机制**
   - 自动选择可用账号（按使用次数和最后使用时间排序）
   - 跳过无效账号（status != 'active' 或无 token）
   - 跳过限流账号（recovery_time 未到）

5. ✅ **图片下载和存储**
   - 从 ChatGPT 响应中提取图片 URL
   - 自动下载图片到本地
   - 保存到 `backend/uploads/` 目录
   - 提供静态文件服务

6. ✅ **错误处理和重试**
   - 429 错误：自动标记账号限流1小时
   - 401/403 错误：标记账号为 'invalid'
   - 下载失败：跳过继续处理其他图片
   - 详细的错误信息返回

7. ✅ **使用统计**
   - 记录每次成功调用
   - 更新账号使用次数
   - 更新最后使用时间

### 使用指南：

详见：[HOW_TO_GET_ACCESS_TOKEN.md](./HOW_TO_GET_ACCESS_TOKEN.md)

---

## 📋 当前 chatgpt2api 的完整流程

### 1. 前端发起请求
```javascript
// web/src/app/image/page.tsx
createImageGenerationTask(
  taskId,
  prompt,      // 用户输入的提示词
  model,       // 选择的模型（auto/gpt-image-2/codex-gpt-image-2）
  size,        // 图片尺寸
  undefined,   // quality
  count,       // 生成数量
  messages,    // 对话历史
  visibility,  // 可见性
  resolution,  // 分辨率
  outputFormat,// 输出格式（png/jpeg/webp）
  compression  // 压缩率
)
```

前端调用：`POST /api/creation-tasks/image-generations`

### 2. 后端接收请求
```go
// internal/httpapi/app.go
HandleImageGenerations(ctx, payload)
  ↓
// internal/protocol/api.go
func (e *Engine) HandleImageGenerations(ctx, body) {
  // 解析参数
  prompt := body["prompt"]
  model := body["model"]  // 默认 "auto"
  n := body["n"]          // 生成数量
  size := body["size"]    // 尺寸
  
  // 调用生成引擎
  outputs, errCh := e.StreamImageOutputsWithPool(ctx, request)
  
  // 收集结果
  result, err := e.CollectImageOutputsWithProgress(outputs, errCh, callback)
  return result, nil, err
}
```

### 3. 从账号池获取可用账号
```go
// internal/protocol/conversation.go
func (e *Engine) nextImageAccessToken(ctx) (string, error) {
  // 从账号池获取可用的 ChatGPT access_token
  return e.Accounts.GetAvailableAccessTokenFor(ctx, nil)
}
```

**关键点**：这里从数据库中的 **accounts 表**获取：
- `email` - ChatGPT 账号邮箱
- `password` - 账号密码（可选）
- `access_token` - **最重要**：ChatGPT 的访问令牌
- `status` - 账号状态（正常/限流/禁用）
- `quota` - 剩余额度
- `type` - 账号类型（Free/Plus/Pro）

### 4. 调用 ChatGPT 官方 API
```go
// internal/backend/backend.go
client := backend.NewClient(token, accounts, proxy)

// 调用 ChatGPT 官方接口
client.StreamResponsesImage(ctx, backend.ResponsesImageRequest{
  Prompt:            prompt,
  Model:             model,
  Size:              size,
  Quality:           quality,
  OutputFormat:      outputFormat,
  OutputCompression: compression,
  ...
})
```

实际请求：
```
POST https://chatgpt.com/backend-api/f/conversation
Authorization: Bearer {access_token}

或

POST https://chatgpt.com/backend-api/codex/responses  
Authorization: Bearer {access_token}
```

### 5. 处理返回结果
```go
// 流式接收图片数据
for event := range events {
  if event.PartialImage != "" {
    // 发送进度更新
    out <- ImageOutput{Kind: "progress", ...}
  }
  if event.ImageURL != "" {
    // 下载图片
    imageData := downloadImage(event.ImageURL)
    
    // 保存到本地
    savedPath := saveImage(imageData, outputFormat, compression)
    
    // 返回结果
    out <- ImageOutput{
      Kind: "result",
      URL: savedPath,
      B64JSON: base64.Encode(imageData),
      ...
    }
  }
}
```

### 6. 前端接收结果
```javascript
// 轮询任务状态
const tasks = await fetchCreationTasks(taskIds)

tasks.forEach(task => {
  if (task.status === "completed") {
    // 显示生成的图片
    displayImage(task.data.images)
  }
})
```

---

## ❌ 当前 Daydream Studio 的问题

### 1. 后端缺少核心功能

我们的后端 `backend/src/index.js` **只有简单的模拟逻辑**：

```javascript
// 当前代码 - 只是返回模拟图片
app.post('/api/images/generate', authenticateToken, (req, res) => {
  const { prompt } = req.body;
  
  // ❌ 问题：直接返回占位图，没有真正调用 ChatGPT
  const imageUrl = `https://picsum.photos/seed/${Date.now()}/1024/1024`;
  
  // 保存到数据库
  db.run('INSERT INTO images (user_id, prompt, url) VALUES (?, ?, ?)', [
    req.user.id,
    prompt,
    imageUrl
  ]);
  
  res.json({ url: imageUrl, status: 'completed' });
});
```

### 2. 缺少的关键组件

1. ✅ **账号池表** - 已有，但字段不完整
2. ❌ **access_token 字段** - accounts 表缺少此字段
3. ❌ **ChatGPT API 调用逻辑** - 完全没有
4. ❌ **账号轮询机制** - 没有从池中选择账号
5. ❌ **错误处理和重试** - 没有处理限流、失败等
6. ❌ **图片下载和保存** - 没有真正处理图片数据

---

## ✅ 改进方案

### 方案 A：完整实现（推荐用于生产）

**需要实现的功能：**

1. **增强 accounts 表**
```sql
ALTER TABLE accounts ADD COLUMN access_token TEXT;
ALTER TABLE accounts ADD COLUMN refresh_token TEXT;
ALTER TABLE accounts ADD COLUMN expires_at DATETIME;
```

2. **实现 ChatGPT API 调用**
   - 使用账号池中的 `access_token`
   - 调用 `https://chatgpt.com/backend-api/f/conversation`
   - 处理流式响应（SSE）
   - 下载生成的图片
   - 保存到本地文件系统

3. **实现账号管理**
   - 轮询选择可用账号
   - 检测账号限流状态
   - 自动切换失效账号
   - 记录使用次数和配额

4. **实现任务队列**
   - 异步处理生成请求
   - 支持批量生成
   - 实时进度更新

### 方案 B：简化实现（推荐用于演示）

**使用 OpenAI DALL-E API 代替 ChatGPT**

优点：
- ✅ 官方 API，稳定可靠
- ✅ 不需要管理 ChatGPT access_token
- ✅ 实现简单，代码量少
- ✅ 可以真正生成图片

缺点：
- ❌ 需要 OpenAI API Key（付费）
- ❌ 不是 ChatGPT 的图片功能

实现代码：

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/api/images/generate', authenticateToken, async (req, res) => {
  const { prompt, size = '1024x1024', n = 1 } = req.body;
  
  try {
    // 调用 OpenAI DALL-E API
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: n,
      size: size,
    });
    
    const imageUrl = response.data[0].url;
    
    // 保存到数据库
    db.run('INSERT INTO images (user_id, prompt, url) VALUES (?, ?, ?)', [
      req.user.id,
      prompt,
      imageUrl
    ]);
    saveDB();
    
    res.json({
      id: Date.now(),
      url: imageUrl,
      prompt: prompt,
      status: 'completed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 方案 C：混合方案（最灵活）

**支持多个图片生成后端**

1. **ChatGPT 官方** - 使用账号池中的 access_token
2. **OpenAI DALL-E** - 使用 API Key
3. **Stable Diffusion** - 自部署模型
4. **其他 API** - Midjourney、Leonardo.ai 等

数据库设计：
```sql
ALTER TABLE accounts ADD COLUMN provider TEXT DEFAULT 'chatgpt';
-- provider: 'chatgpt' | 'openai' | 'stability' | 'midjourney'

ALTER TABLE accounts ADD COLUMN credentials TEXT;
-- JSON 格式存储不同凭证：
-- ChatGPT: {"access_token": "...", "refresh_token": "..."}
-- OpenAI: {"api_key": "sk-..."}
-- StabilityAI: {"api_key": "..."}
```

---

## 🔧 如何让当前系统真正工作

### 立即可用的最小实现

**1. 添加 access_token 字段到 accounts 表**

```javascript
// backend/src/index.js 初始化时
db.run(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    password TEXT,
    access_token TEXT,           -- ← 新增
    refresh_token TEXT,          -- ← 新增  
    type TEXT DEFAULT 'free',
    status TEXT DEFAULT 'active',
    quota INTEGER DEFAULT 0,
    recovery_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
```

**2. 在管理端添加账号时，要求输入 access_token**

修改前端 `AccountPoolPage.jsx`：
```jsx
<div className="form-group">
  <label>Access Token</label>
  <textarea
    value={formData.access_token}
    onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
    placeholder="输入 ChatGPT access token..."
    rows="4"
  />
</div>
```

**3. 实现基础的图片生成逻辑**

```javascript
app.post('/api/images/generate', authenticateToken, async (req, res) => {
  const { prompt, model = 'auto', size = '1024x1024' } = req.body;
  
  try {
    // 1. 从账号池获取可用账号
    const account = getOne(
      'SELECT * FROM accounts WHERE status = ? AND access_token IS NOT NULL ORDER BY RANDOM() LIMIT 1',
      ['active']
    );
    
    if (!account) {
      return res.status(503).json({ error: '没有可用的账号' });
    }
    
    // 2. 调用 ChatGPT API
    const response = await fetch('https://chatgpt.com/backend-api/f/conversation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'next',
        messages: [{
          role: 'user',
          content: { content_type: 'text', parts: [prompt] }
        }],
        model: 'gpt-4',
        // ... 更多参数
      })
    });
    
    // 3. 处理响应（这部分很复杂，需要解析 SSE 流）
    const result = await response.json();
    
    // 4. 保存结果
    db.run('INSERT INTO images (user_id, prompt, url) VALUES (?, ?, ?)', [
      req.user.id,
      prompt,
      result.image_url
    ]);
    saveDB();
    
    res.json({ url: result.image_url, status: 'completed' });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 📝 总结

### 当前状态
- ✅ 前端界面完整
- ✅ 用户系统完整
- ✅ 账号池管理界面完整
- ❌ **缺少真正的图片生成逻辑**
- ❌ **accounts 表缺少 access_token 字段**

### 要实现完整闭环，需要：

**最小可行方案（2-3小时）：**
1. 添加 `access_token` 字段到数据库 ✓ 简单
2. 修改前端表单支持输入 token ✓ 简单
3. 使用 OpenAI DALL-E API 替代 ChatGPT ✓ 中等

**完整 ChatGPT 方案（1-2周）：**
1. 添加完整的账号字段（tokens, expires_at 等）
2. 实现 ChatGPT SSE 流式接口调用
3. 实现图片下载和本地存储
4. 实现账号轮询和错误处理
5. 实现限流检测和自动切换
6. 实现任务队列和进度更新

**建议：**
- 🎯 **演示/学习**：使用方案B（OpenAI DALL-E）
- 🎯 **生产环境**：参考 chatgpt2api 完整实现方案A
- 🎯 **灵活性**：使用方案C（支持多个后端）

需要我帮你实现其中某个方案吗？
