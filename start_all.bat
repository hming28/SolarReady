@echo off
title SolarReady Malaysia Launcher
echo Starting SolarReady Malaysia (Backend + Frontend)...
start "SolarReady Backend" cmd /c "%~dp0run_backend.bat"
timeout /t 2 /nobreak >nul
start "SolarReady Frontend" cmd /c "%~dp0run_frontend.bat"
echo.
echo Both services have been launched in separate windows!
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://localhost:3000
echo.
pause
