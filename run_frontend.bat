@echo off
title SolarReady Frontend
cd /d "%~dp0frontend"
echo ========================================================
echo   SolarReady Malaysia - Next.js Frontend Service
echo   Running at: http://localhost:3000
echo ========================================================
call npm run dev
pause
