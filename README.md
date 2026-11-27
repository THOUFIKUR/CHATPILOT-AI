# ChatPilot AI 🚀

**ChatPilot AI** is a Windows-first personal WhatsApp AI assistant designed to learn your individual communication style from historical conversations, maintain separate memory for every contact and group, understand incoming WhatsApp messages, and generate tailored, authentic replies.

---

## 🌟 Key Features

- **Personalized Writing Style Learning**: Automatically analyzes outgoing messages for language (Tamil, Tanglish, English), slang (`da`, `bro`, `machi`, etc.), sentence length, and formality.
- **Isolated Memory per Contact**: Maintains distinct facts, context summaries, and history for each contact and group without cross-contamination.
- **Multi-Provider AI Engine**: Integrated with **Groq**, **Google Gemini**, and **OpenRouter** with dynamic latency tracking, priority fallbacks, and cost monitoring.
- **Reply Inbox with Review Flow**: Manual review with 1-click **Approve & Send**, inline draft editing, or rejection.
- **WhatsApp Historical Chat Importer**: Import `.txt` WhatsApp chat exports, identify your sender name, preview statistics, and extract memory and writing samples.
- **Security & Safety Guardrails**: Hard safety blocks on OTPs, passwords, ATM/UPI PINs, bank transactions, and sensitive personal data.
- **Interactive Windows Simulator**: Test message arrival, AI generation, and draft approval locally before connecting to live devices.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend**: Python 3.12, FastAPI, Pydantic, HTTPX, Supabase SDK
- **Database**: Supabase PostgreSQL (15 dedicated tables)
- **AI Providers**: Groq API, Google Gemini API, OpenRouter API

---

## 🚀 Quick Start (Windows)

1. **Backend**:
   ```powershell
   cd "D:\CHATPILOT AI\backend"
   python -m pip install -r requirements.txt
   uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```

2. **Frontend**:
   ```powershell
   cd "D:\CHATPILOT AI\frontend"
   npm install
   npm run dev
   ```

3. Open your browser at `http://127.0.0.1:5173`.
