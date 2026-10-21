@echo off
title SolarReady Backend
cd /d "%~dp0backend"
echo ========================================================
echo   SolarReady Malaysia - FastAPI Backend Service
echo   Running at: http://127.0.0.1:8000
echo   Swagger Docs: http://127.0.0.1:8000/docs
echo ========================================================
.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000 --reload
pause
