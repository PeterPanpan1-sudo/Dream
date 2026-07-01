# Daydream Studio

一个带管理端的 AI 图片生成平台，支持用户创作和管理员后台管理。

## 功能特性

### 用户端
- 🎨 AI 图片生成创作台
- 🖼️ 图片库管理
- 👤 个人账户管理
- ⚙️ 个性化设置
- 🌓 深色/浅色主题切换

### 管理端
- 👥 用户管理
- 🔑 号池管理
- 🛡️ 角色权限管理
- 📊 日志管理
- 📈 数据统计

## 快速开始

### 使用 Docker Compose（推荐）

```bash
# 1. 克隆项目
git clone <your-repo>
cd daydream-studio

# 2. 复制环境配置
cp backend/.env.example backend/.env

# 3. 编辑 backend/.env 设置管理员密码（可选）
# ADMIN_USERNAME=admin
# ADMIN_PASSWORD=your_password

# 4. 启动服务
docker-compose up -d

# 5. 访问应用
# http://localhost:3000
```

默认管理员账号：
- 用户名：`admin`
- 密码：`admin123`（可在 `.env` 中修改）

### 本地开发

**后端：**

```bash
cd backend
npm install
npm run dev
```

后端运行在 `http://localhost:8000`

**前端：**

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:5173`

## 技术栈

### 前端
- React 19
- Vite 8
- Framer Motion 12
- Tailwind CSS 4
- Lucide React Icons

### 后端
- Node.js + Express
- SQLite (better-sqlite3)
- JWT 认证
- bcrypt 密码加密

### 部署
- Docker
- Docker Compose
- Nginx (可选)

## 项目结构

```
daydream-studio/
├── frontend/           # React 前端应用
│   ├── src/
│   │   ├── pages/     # 页面组件
│   │   ├── components/ # 公共组件
│   │   └── App.jsx    # 主应用
│   └── package.json
├── backend/            # Node.js 后端 API
│   ├── src/
│   │   └── index.js   # Express 服务器
│   └── package.json
├── docker-compose.yml  # Docker Compose 配置
└── README.md
```

## API 文档

### 认证相关
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/logout` - 用户登出

### 用户管理（管理员）
- `GET /api/users` - 获取用户列表
- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户

### 号池管理（管理员）
- `GET /api/accounts` - 获取账号列表
- `POST /api/accounts` - 创建账号
- `PUT /api/accounts/:id` - 更新账号
- `DELETE /api/accounts/:id` - 删除账号

### 角色权限（管理员）
- `GET /api/roles` - 获取角色列表
- `POST /api/roles` - 创建角色
- `PUT /api/roles/:id` - 更新角色
- `DELETE /api/roles/:id` - 删除角色

### 日志管理（管理员）
- `GET /api/logs` - 获取操作日志

### 图片生成
- `GET /api/images` - 获取用户图片列表
- `POST /api/images/generate` - 生成图片

### 统计数据
- `GET /api/stats` - 获取统计数据

## 环境变量

```env
# 服务器配置
PORT=8000
NODE_ENV=production

# 安全配置
JWT_SECRET=your_random_secret_key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# 数据库
DATABASE_PATH=./data/daydream.db

# 文件存储
UPLOAD_DIR=./data/uploads
```

## 部署说明

### Docker 部署

1. 修改 `backend/.env` 设置生产环境配置
2. 运行 `docker-compose up -d`
3. 数据会持久化到 `./data` 目录
4. 查看日志：`docker-compose logs -f`

### 更新镜像

```bash
docker-compose pull
docker-compose up -d
```

### 备份数据

```bash
# 备份数据库
cp backend/data/daydream.db backup/daydream-$(date +%Y%m%d).db
```

## 许可证

MIT License


