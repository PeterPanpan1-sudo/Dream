@echo off
chcp 65001 >nul
echo.
echo 🚀 启动 Daydream Studio...
echo.

REM 检查后端 .env 文件
if not exist backend\.env (
  echo 📝 创建后端 .env 文件...
  copy backend\.env.example backend\.env >nul
)

REM 启动后端
echo 🔧 启动后端服务...
cd backend
start "Daydream Backend" cmd /k "npm install && npm start"
cd ..

REM 等待后端启动
timeout /t 3 /nobreak >nul

REM 启动前端
echo 🎨 启动前端服务...
cd frontend
start "Daydream Frontend" cmd /k "npm install && npm run dev"
cd ..

echo.
echo ✅ 服务启动成功！
echo.
echo 📍 访问地址：
echo    前端：http://localhost:5173
echo    后端：http://localhost:8000
echo.
echo 👤 默认管理员账号：
echo    用户名：admin
echo    密码：admin123
echo.
echo ⚠️  关闭命令窗口以停止服务
echo.
pause
