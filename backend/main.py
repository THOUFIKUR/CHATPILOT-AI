import sys
import os

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import initialize_default_data
from routers import (
    contacts, groups, conversations, memory, ai, replies, 
    importer, diagnostics, settings, webhooks, assistant, package_importer_router,
    parveen_router, auth, connectors
)

app = FastAPI(
    title="ChatPilot AI API",
    description="Backend service for Windows-first Personal WhatsApp AI Assistant",
    version="1.0.0"
)

# CORS configuration for desktop and web interfaces
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(contacts.router)
app.include_router(groups.router)
app.include_router(conversations.router)
app.include_router(memory.router)
app.include_router(ai.router)
app.include_router(replies.router)
app.include_router(importer.router)
app.include_router(diagnostics.router)
app.include_router(settings.router)
app.include_router(webhooks.router)
app.include_router(assistant.router)
app.include_router(package_importer_router.router)
app.include_router(parveen_router.router)
app.include_router(auth.router)
app.include_router(connectors.router)

@app.on_event("startup")
async def on_startup():
    initialize_default_data()

@app.get("/api/health")
async def health_check():
    db_status = "connected"
    contact_count = 88
    try:
        from database import get_supabase
        sb = get_supabase()
        res = sb.table("contacts").select("count", count="exact").execute()
        if res.count is not None:
            contact_count = res.count
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy" if "error" not in db_status else "degraded",
        "app": "ChatPilot AI",
        "version": "1.0.0",
        "services": {
            "database": db_status,
            "contacts_count": contact_count,
            "ai_providers": ["Groq", "Gemini", "OpenRouter"],
            "bridge": "ready"
        }
    }

@app.get("/")
async def root():
    return {"message": "ChatPilot AI API is running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
