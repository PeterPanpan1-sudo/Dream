# 🔑 如何获取 ChatGPT Access Token

## 方法 1：通过浏览器开发者工具（推荐）

### 步骤：

1. **登录 ChatGPT**
   - 打开浏览器访问：https://chatgpt.com/
   - 用你的 ChatGPT 账号登录

2. **打开开发者工具**
   - Chrome/Edge：按 `F12` 或 `Ctrl + Shift + I`
   - Firefox：按 `F12` 或 `Ctrl + Shift + I`
   - Safari：`Option + Command + I`

3. **进入 Application/存储 标签页**
   - Chrome/Edge：点击 `Application` 标签
   - Firefox：点击 `存储` 标签
   - Safari：点击 `存储` 标签

4. **找到 Cookies**
   - 左侧菜单找到 `Cookies` → `https://chatgpt.com`

5. **查找 __Secure-next-auth.session-token**
   - 在 Cookie 列表中找到名为 `__Secure-next-auth.session-token` 的项
   - 这个 Cookie 的值就是你需要的 session token

6. **获取 Access Token**
   
   **方法 A：直接从 API 响应获取**
   - 切换到 `Network`（网络）标签
   - 在 ChatGPT 页面发送一条消息
   - 在网络请求中找到 `conversation` 或类似的请求
   - 查看 Request Headers 中的 `Authorization: Bearer ...`
   - `Bearer` 后面的就是 access_token

   **方法 B：通过 Session Token 获取**
   - 使用下面的 API 端点：
   ```bash
   curl https://chatgpt.com/api/auth/session \
     -H "Cookie: __Secure-next-auth.session-token=YOUR_SESSION_TOKEN"
   ```
   - 返回的 JSON 中 `accessToken` 字段就是你需要的

7. **复制 Access Token**
   - 完整复制 access_token（通常以 `eyJhbGciOi` 开头）
   - 粘贴到 Daydream Studio 的账号池管理页面

---

## 方法 2：使用浏览器扩展

有一些第三方浏览器扩展可以自动提取 ChatGPT 的 access_token：

- **ChatGPT Token Extractor**（需自行搜索）
- 或者使用油猴脚本自动提取

⚠️ **注意**：使用第三方扩展时请谨慎，确保来源可信。

---

## 方法 3：使用 Python 脚本

如果你有 ChatGPT Plus 账号，可以使用以下脚本：

```python
import requests

def get_access_token(session_token):
    """
    通过 session_token 获取 access_token
    """
    url = "https://chatgpt.com/api/auth/session"
    headers = {
        "Cookie": f"__Secure-next-auth.session-token={session_token}"
    }
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        return data.get("accessToken")
    else:
        return None

# 使用示例
session_token = "YOUR_SESSION_TOKEN_HERE"
access_token = get_access_token(session_token)
print(f"Access Token: {access_token}")
```

---

## Token 特征

### Session Token
- 名称：`__Secure-next-auth.session-token`
- 长度：约 200+ 字符
- 格式：随机字符串

### Access Token
- 格式：JWT (JSON Web Token)
- 开头：通常是 `eyJhbGciOi...`
- 长度：约 1000-2000 字符
- 包含三部分，用 `.` 分隔：`header.payload.signature`

---

## 验证 Token 是否有效

使用以下命令测试 access_token：

```bash
curl https://chatgpt.com/backend-api/models \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

如果返回模型列表，说明 token 有效。

---

## ⚠️ 安全注意事项

1. **不要泄露你的 Token**
   - Access Token 相当于你的账号登录凭证
   - 不要在公共场合分享
   - 不要提交到 Git 仓库

2. **Token 有效期**
   - Access Token 通常有效期为 **1-2 周**
   - Session Token 可能更长（1-2个月）
   - 过期后需要重新获取

3. **账号安全**
   - 建议使用专门的 ChatGPT 账号用于 API 调用
   - 不要用主账号
   - 定期更换 Token

4. **使用限制**
   - ChatGPT Plus 账号有更高的 API 速率限制
   - 免费账号会受到更严格的限流
   - 频繁调用可能导致账号被限制

---

## 常见问题

### Q: Token 多久过期？
**A**: Access Token 通常 1-2 周过期，Session Token 可能更长。过期后系统会自动标记账号为"禁用"状态。

### Q: 如何刷新 Token？
**A**: 
1. 如果有 refresh_token，系统会自动刷新（尚未实现自动刷新）
2. 或者重新从浏览器获取新的 token

### Q: 为什么提示 "Invalid token"？
**A**: 
- Token 已过期
- Token 格式不正确
- 账号被封禁
- 网络请求被拦截

### Q: 可以多个地方同时使用一个 Token 吗？
**A**: 理论上可以，但可能会被 ChatGPT 检测为异常行为。建议每个账号单独使用。

---

## 添加账号到系统

1. 登录 Daydream Studio 管理端
2. 进入 **号池管理** 页面
3. 点击 **添加账号**
4. 填写表单：
   - **邮箱**：ChatGPT 账号邮箱
   - **Access Token**：从上述方法获取的 token（必填）
   - **Refresh Token**：可选
   - **类型**：Free / Plus / Pro
   - **额度**：设置使用额度限制
5. 点击 **添加** 保存

---

## 测试账号是否可用

添加账号后，进入 **创作** 页面：
1. 输入提示词，例如："a cute cat"
2. 点击 **生成**
3. 查看控制台日志，确认：
   - 系统选择了可用账号
   - 成功调用 ChatGPT API
   - 图片生成成功

如果失败，检查：
- Token 是否正确
- Token 是否过期
- 网络连接是否正常
- 账号是否被限流

---

## 🎯 快速测试

想快速测试系统是否工作？使用这个一键脚本：

```bash
# 进入后端目录
cd backend

# 安装依赖（如果还没安装）
npm install

# 启动服务
npm start
```

然后在管理端添加你的 ChatGPT access_token，就可以开始生成图片了！
