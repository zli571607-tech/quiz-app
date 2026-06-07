@echo off
title 刷题软件 - 公网服务器

echo ========================================
echo   刷题软件 - 启动中...
echo ========================================
echo.

REM 启动开发服务器
echo [1/2] 启动本地服务器...
start "刷题软件-本地" /B cmd /c "npm run dev"
timeout /t 3 >nul

REM 启动公网隧道（带自动重连）
echo [2/2] 启动公网隧道...
:loop
echo.
echo 正在建立公网连接...
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=10 -o ServerAliveCountMax=3 -o TCPKeepAlive=yes -R 80:localhost:5173 nokey@localhost.run 2>nul
echo 连接断开，5秒后自动重连...
timeout /t 5 >nul
goto loop
