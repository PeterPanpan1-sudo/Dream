# Daydream Studio 部署文档

本文档用于将 Daydream Studio 从本地开发环境部署到服务器或容器环境。项目由两个服务组成：

- 后端：Node.js + Express，默认监听 `8000`
- 前端：React + Vite，开发环境默认监听 `5173`，生产环境构建为静态文件

> 安全提醒：不要提交 `backend/.env`、数据库文件、上传文件、npm 缓存或任何真实 Token/密码。仓库已经通过 `.gitignore` 忽略这些本地数据。

## 1. 环境要求

### 1.1 基础环境

- Node.js：建议 `20.x` 或更高版本
- npm：随 Node.js 安装
- Git：用于拉取代码
- 可选：Docker 与 Docker Compose
- 可选：Nginx，用于生产反向代理和 HTTPS

### 1.2 默认端口

| 服务 | 默认端口 | 说明 |
| --- | --- | --- |
| 后端 | `8000` | Express API 服务 |
| 前端开发服务 | `5173` | Vite 开发服务 |
| 前端生产服务 | `80`/`443` | 通常由 Nginx 提供静态文件 |

## 2. 获取代码

```bash
git clone https://github.com/PeterPanpan1-sudo/Dream.git
cd Dream
```

如果服务器已经存在项目目录：

```bash
git pull origin master
```

## 3. 环境变量配置

后端配置文件位于 `backend/.env`。首次部署时可以从示例文件复制：

```bash
cp backend/.env.example backend/.env
```

Windows PowerShell：

```powershell
Copy-Item backend/.env.example backend/.env
```

### 3.1 必填/建议配置

```env
PORT=8000
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-password
```

### 3.2 邮件登录配置

如需启用邮箱验证码登录/找回密码，配置 SMTP：

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=Daydream Studio <noreply@example.com>
```

### 3.3 Cloudflare R2 配置

如需将生成图片上传到 Cloudflare R2，配置：

```env
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET=your-bucket-name
R2_PUBLIC_URL=https://your-public-r2-domain.example.com
```

### 3.4 临时邮箱注册机配置

管理员注册机依赖临时邮箱服务时配置：

```env
TEMP_MAIL_WORKER_URL=https://your-temp-mail-api.example.com
TEMP_MAIL_ADMIN_AUTH=replace-with-admin-auth
TEMP_MAIL_DOMAIN=edu.peterlinux.com
TEMP_MAIL_ENABLE_PREFIX=true
```

说明：

- `TEMP_MAIL_ADMIN_AUTH` 为临时邮箱服务管理员鉴权值。
- 每个邮箱自己的 JWT 通常由创建邮箱接口返回，系统会保存，不需要手动写入 `.env`。

## 4. 本地开发启动

### 4.1 安装依赖

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 4.2 启动后端

```bash
cd backend
npm run dev
```

后端启动成功后访问：

```text
http://127.0.0.1:8000/health
```

正常返回示例：

```json
{"status":"ok","timestamp":"2026-01-01T00:00:00.000Z"}
```

### 4.3 启动前端

```bash
cd frontend
npm run dev
```

前端访问地址：

```text
http://localhost:5173/
```

### 4.4 Windows 端口占用处理

如果后端出现 `EADDRINUSE: address already in use :::8000`，说明 `8000` 已被占用。

查看占用：

```powershell
netstat -ano | findstr :8000
```

结束进程：

```powershell
taskkill /PID <PID> /F /T
```

前端端口同理检查 `5173` 或 `5174`。

## 5. 生产部署：Node.js + Nginx

### 5.1 安装依赖

```bash
cd backend
npm ci --omit=dev

cd ../frontend
npm ci
```

如果没有提交 lock 文件，也可以使用：

```bash
npm install
```

### 5.2 构建前端

```bash
cd frontend
npm run build
```

构建产物默认位于：

```text
frontend/dist
```

### 5.3 启动后端

直接启动：

```bash
cd backend
npm start
```

建议使用 PM2 守护：

```bash
npm install -g pm2
cd backend
pm2 start npm --name daydream-backend -- start
pm2 save
pm2 startup
```

常用 PM2 命令：

```bash
pm2 status
pm2 logs daydream-backend
pm2 restart daydream-backend
pm2 stop daydream-backend
```

### 5.4 Nginx 配置示例

将 `frontend/dist` 作为静态站点，将 `/api` 和 `/uploads` 反向代理到后端。

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/daydream-studio/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:8000/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

配置后检查并重载：

```bash
nginx -t
systemctl reload nginx
```

### 5.5 HTTPS

推荐使用 Certbot：

```bash
certbot --nginx -d your-domain.com
```

## 6. Docker Compose 部署

项目包含 `docker-compose.yml`，可以按需使用：

```bash
docker compose up -d --build
docker compose logs -f
docker compose down
```

如使用旧版 Docker Compose：

```bash
docker-compose up -d --build
```

部署前确认：

- `backend/.env` 已配置好
- 持久化目录已正确挂载
- 服务器防火墙已开放需要的端口

## 7. 数据与备份

### 7.1 数据目录

默认数据库：

```text
backend/data/daydream.db
```

默认上传目录：

```text
backend/uploads
```

这些目录属于运行数据，不应提交到 Git。

### 7.2 建议备份

至少定期备份：

- `backend/data/daydream.db`
- `backend/uploads/`
- `backend/.env`

示例：

```bash
tar -czf daydream-backup-$(date +%F).tar.gz backend/data backend/uploads backend/.env
```

## 8. 升级发布流程

推荐生产更新步骤：

```bash
git pull origin master

cd backend
npm install

cd ../frontend
npm install
npm run build

pm2 restart daydream-backend
```

更新后验证：

```bash
curl http://127.0.0.1:8000/health
```

浏览器访问前端域名确认页面正常。

## 9. 常见问题

### 9.1 后端端口被占用

错误：

```text
EADDRINUSE: address already in use :::8000
```

处理：

```bash
lsof -i :8000
kill -9 <PID>
```

Windows：

```powershell
netstat -ano | findstr :8000
taskkill /PID <PID> /F /T
```

### 9.2 前端接口请求失败

检查：

- 后端是否启动
- `http://127.0.0.1:8000/health` 是否返回 `200`
- Nginx `/api/` 代理是否正确
- 开发环境 `frontend/vite.config.js` 的代理目标是否指向后端

### 9.3 登录失败

检查：

- 管理员账号密码是否与数据库初始化后的实际值一致
- `JWT_SECRET` 是否变化导致旧 Token 失效
- 浏览器 localStorage 中旧 Token 可清理后重试

### 9.4 图片无法显示或下载慢

检查：

- R2 环境变量是否配置完整
- `R2_PUBLIC_URL` 是否可公网访问
- 存储桶 CORS/公开访问策略是否正确

### 9.5 临时邮箱接口不可用

检查：

- `TEMP_MAIL_WORKER_URL` 是否为 API 地址而不是前端页面地址
- `TEMP_MAIL_ADMIN_AUTH` 是否正确
- 临时邮箱服务是否允许服务器 IP 调用

## 10. 安全清单

生产环境上线前建议确认：

- 已更换默认管理员密码
- `JWT_SECRET` 足够长且随机
- `backend/.env` 未提交到仓库
- 数据库和上传目录已加入备份
- Nginx 已开启 HTTPS
- 服务器防火墙只开放必要端口
- 管理后台只开放给可信人员

## 11. 快速验证命令

后端：

```bash
curl http://127.0.0.1:8000/health
```

前端开发环境：

```bash
curl http://localhost:5173/
```

生产环境：

```bash
curl https://your-domain.com/
curl https://your-domain.com/api/health
```
