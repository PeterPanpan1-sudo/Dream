#!/bin/bash

echo "🚀 启动 Daydream Studio..."

# 检查后端 .env 文件
if [ ! -f backend/.env ]; then
  echo "📝 创建后端 .env 文件..."
  cp backend/.env.example backend/.env
fi

# 启动后端
echo "🔧 启动后端服务..."
cd backend
npm install
npm start &
BACKEND_PID=$!
cd ..

# 等待后端启动
sleep 3

# 启动前端
echo "🎨 启动前端服务..."
cd frontend
npm install
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ 服务启动成功！"
echo ""
echo "📍 访问地址："
echo "   前端：http://localhost:5173"
echo "   后端：http://localhost:8000"
echo ""
echo "👤 默认管理员账号："
echo "   用户名：admin"
echo "   密码：admin123"
echo ""
echo "⚠️  按 Ctrl+C 停止所有服务"
echo ""

# 等待用户中断
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
