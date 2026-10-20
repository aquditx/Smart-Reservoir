@echo off
REM One-click demo: serves the built dashboard + API on http://localhost:8000
cd /d "%~dp0"
if not exist frontend\dist\index.html (
  echo Building the dashboard first...
  call npm --prefix frontend run build
)
start "" http://localhost:8000
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8000
