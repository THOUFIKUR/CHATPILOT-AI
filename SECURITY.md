# Security and Privacy Policy

## Core Security Tenets
- **Never expose secrets**: All API keys and Supabase secret keys are confined strictly to the backend environment (`backend/.env`).
- **No Git leaks**: `.env` and sensitive configurations are included in `.gitignore`.
- **Hard Safety Guardrail**:
  Messages containing:
  - OTPs or verification codes
  - Passwords or credentials
  - Bank account numbers, credit/debit cards
  - UPI / ATM PINs
  are blocked from auto-reply generation before reaching any AI provider.
- **Per-User RLS**: All Supabase rows are associated with the authenticated `owner_id`.
- **Local Parsing**: WhatsApp `.txt` exports are parsed locally on the machine.
