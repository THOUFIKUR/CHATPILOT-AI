# Windows Setup Guide

## Requirements
- Windows 10/11
- Python 3.11 or 3.12 (`python --version`)
- Node.js 18+ (`node -v`)

## Running the Application on Windows

### 1. Start the FastAPI Backend
```powershell
cd "D:\CHATPILOT AI\backend"
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
Health Check: `http://127.0.0.1:8000/api/health`
API Documentation: `http://127.0.0.1:8000/docs`

### 2. Start the React Frontend
```powershell
cd "D:\CHATPILOT AI\frontend"
npm run dev -- --host 127.0.0.1 --port 5173
```
Dashboard: `http://127.0.0.1:5173`
