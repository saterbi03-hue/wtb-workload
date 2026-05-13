# Start WTB Workload Engine (backend + frontend)
# Usage: .\start.ps1

$root = $PSScriptRoot

Write-Host "Starting backend (FastAPI on :8000)..."
Start-Process -FilePath "cmd" -ArgumentList "/c cd `"$root\backend`" && python -m uvicorn api.main:app --reload --port 8000" -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "Starting frontend (Vite on :5173)..."
Start-Process -FilePath "cmd" -ArgumentList "/c cd `"$root\frontend`" && npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "App running at: http://localhost:5173"
Write-Host "API docs at:    http://localhost:8000/docs"
