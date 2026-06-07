@echo off
echo ==================================
echo   刷题软件 - 公网模式
echo   手机可用流量访问
echo ==================================
echo.
echo 启动服务器...
start /B node server.js
timeout /t 2 >nul
echo 创建公网隧道...
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:5173 serveo.net
