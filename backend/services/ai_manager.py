import httpx
import time
import json
import logging
from typing import List, Dict, Any, Optional
from config import settings
from database import get_supabase

logger = logging.getLogger(__name__)

class AIProviderManager:
    def __init__(self):
        self.supabase = get_supabase()
        self._active_model: Dict[str, str] = {
            "provider_name": "groq",
            "model_name": "qwen/qwen3.8-27b"
        }

    def get_active_model(self) -> Dict[str, str]:
        """Returns the current globally active model configuration."""
        return getattr(self, "_active_model", {"provider_name": "groq", "model_name": "qwen/qwen3.8-27b"})

    def set_active_model(self, provider_name: str, model_name: str) -> Dict[str, str]:
        """Sets the globally active model with one-tap across the chatbot and auto-reply."""
        p_clean = provider_name.lower().strip()
        m_clean = model_name.strip()
        self._active_model = {
            "provider_name": p_clean,
            "model_name": m_clean
        }
        logger.info(f"One-tap active AI model set to: {p_clean} ({m_clean})")
        try:
            # Set chosen provider priority to 1 in DB
            self.supabase.table("ai_providers").update({
                "priority": 1, 
                "model_name": m_clean, 
                "is_enabled": True
            }).ilike("provider_name", f"%{p_clean}%").execute()
            
            # Demote others
            others = self.supabase.table("ai_providers").select("id, provider_name").not_.ilike("provider_name", f"%{p_clean}%").execute().data or []
            for idx, op in enumerate(others):
                self.supabase.table("ai_providers").update({"priority": idx + 2}).eq("id", op["id"]).execute()
        except Exception as e:
            logger.warning(f"Could not persist active model priority in DB: {e}")
            
        return self._active_model

    async def test_provider(self, provider_name: str, model_name: Optional[str] = None) -> Dict[str, Any]:
        """Test connection and return latency + sample output."""
        start_time = time.time()
        test_prompt = "Hello! Test connection. Respond with 1 sentence."
        try:
            result = await self.generate_with_provider(
                provider_name=provider_name,
                messages=[{"role": "user", "content": test_prompt}],
                model_name=model_name,
                max_tokens=30
            )
            latency = int((time.time() - start_time) * 1000)
            return {
                "success": True,
                "provider": provider_name,
                "model": result.get("model"),
                "latency_ms": latency,
                "response": result.get("content")
            }
        except Exception as e:
            latency = int((time.time() - start_time) * 1000)
            return {
                "success": False,
                "provider": provider_name,
                "latency_ms": latency,
                "error": str(e)
            }

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        preferred_provider: Optional[str] = None,
        preferred_model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 200,
        allow_private_content: bool = True
    ) -> Dict[str, Any]:
        """Generate response with fallback across enabled providers."""
        # Query provider configurations ordered by priority
        try:
            db_providers = self.supabase.table("ai_providers")\
                .select("*")\
                .eq("is_enabled", True)\
                .order("priority", desc=False)\
                .execute()
            provider_list = db_providers.data or []
        except Exception as e:
            logger.warning(f"Failed to fetch AI providers from database: {e}")
            provider_list = []

        if not provider_list:
            logger.info("Using default provider list (Groq, Gemini, OpenRouter)")
            provider_list = [
                {"provider_name": "groq", "model_name": "qwen/qwen3.8-27b", "priority": 1, "is_enabled": True},
                {"provider_name": "gemini", "model_name": "gemini-flash-lite-latest", "priority": 2, "is_enabled": True},
                {"provider_name": "openrouter", "model_name": "deepseek/deepseek-chat", "priority": 3, "is_enabled": True},
            ]
        
        # If no explicit provider given, use the globally active model chosen by the user
        if not preferred_provider and not preferred_model:
            active = self.get_active_model()
            preferred_provider = active.get("provider_name")
            preferred_model = active.get("model_name")

        # If preferred provider is requested, prioritize it
        if preferred_provider:
            provider_list = sorted(
                provider_list,
                key=lambda p: 0 if p["provider_name"].lower() == preferred_provider.lower() else 1
            )
        
        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)

        last_error = None
        for prov in provider_list:
            prov_name = prov["provider_name"]
            model = preferred_model or prov["model_name"]
            
            # Privacy check
            if not allow_private_content and not prov.get("allow_private_content", True):
                logger.info(f"Skipping {prov_name} due to privacy constraint.")
                continue

            start_t = time.time()
            try:
                logger.info(f"Attempting generation with {prov_name} ({model})...")
                res = await self.generate_with_provider(
                    provider_name=prov_name,
                    messages=full_messages,
                    model_name=model,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                latency = int((time.time() - start_t) * 1000)

                # Strict Content Validation: reject empty/whitespace-only responses so fallback triggers
                content_text = (res.get("content") or "").strip()
                if not content_text:
                    raise ValueError(f"Provider {prov_name} returned empty or blank text.")
                
                # Log usage to ai_usage_logs
                self._log_usage(
                    provider_name=prov_name,
                    model_name=res.get("model", model),
                    request_status="success",
                    prompt_tokens=res.get("prompt_tokens", 0),
                    completion_tokens=res.get("completion_tokens", 0),
                    estimated_cost=res.get("estimated_cost", 0.0),
                    latency_ms=latency
                )
                return {
                    "provider": prov_name,
                    "model": res.get("model", model),
                    "content": content_text,
                    "latency_ms": latency,
                    "prompt_tokens": res.get("prompt_tokens", 0),
                    "completion_tokens": res.get("completion_tokens", 0)
                }
            except Exception as e:
                latency = int((time.time() - start_t) * 1000)
                logger.warning(f"Provider {prov_name} ({model}) failed or returned empty: {e}. Falling back...")
                self._log_usage(
                    provider_name=prov_name,
                    model_name=model,
                    request_status="error",
                    prompt_tokens=0,
                    completion_tokens=0,
                    estimated_cost=0.0,
                    latency_ms=latency,
                    error_code=str(e)[:50]
                )
                last_error = e

        raise Exception(f"All AI providers failed. Last error: {last_error}")

    async def generate_with_provider(
        self,
        provider_name: str,
        messages: List[Dict[str, str]],
        model_name: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 200
    ) -> Dict[str, Any]:
        p_name = provider_name.lower()
        if "groq" in p_name:
            return await self._call_groq(messages, model_name or "qwen/qwen3.8-27b", temperature, max_tokens)
        elif "gemini" in p_name:
            return await self._call_gemini(messages, model_name or "gemini-flash-lite-latest", temperature, max_tokens)
        elif "openrouter" in p_name:
            return await self._call_openrouter(messages, model_name or "deepseek/deepseek-chat", temperature, max_tokens)
        else:
            raise ValueError(f"Unsupported AI provider: {provider_name}")

    async def _call_groq(self, messages: List[Dict[str, str]], model: str, temp: float, max_tokens: int) -> Dict[str, Any]:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "ChatPilotAI/1.0"
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temp,
            "max_tokens": max_tokens
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise Exception(f"Groq API error {resp.status_code}: {resp.text}")
            data = resp.json()
            usage = data.get("usage", {})
            msg_obj = data["choices"][0]["message"]
            content_text = msg_obj.get("content") or msg_obj.get("reasoning") or ""
            if not content_text.strip():
                finish_reason = data.get("choices", [{}])[0].get("finish_reason", "unknown")
                raise ValueError(f"Groq {model} returned empty content (finish_reason={finish_reason}).")
            return {
                "content": content_text.strip(),
                "model": data.get("model", model),
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "estimated_cost": 0.0001
            }

    async def _call_gemini(self, messages: List[Dict[str, str]], model: str, temp: float, max_tokens: int) -> Dict[str, Any]:
        # Handle models/ prefix
        clean_model = model.replace("models/", "")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent?key={settings.GEMINI_API_KEY}"
        
        system_instruction = None
        contents = []
        for m in messages:
            if m["role"] == "system":
                system_instruction = {"parts": [{"text": m["content"]}]}
            else:
                role = "user" if m["role"] == "user" else "model"
                contents.append({"role": role, "parts": [{"text": m["content"]}]})
        
        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temp,
                "maxOutputTokens": max_tokens
            }
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise Exception(f"Gemini API error {resp.status_code}: {resp.text}")
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates or "content" not in candidates[0]:
                raise Exception("Gemini returned empty candidate")
            text = candidates[0]["content"]["parts"][0]["text"].strip()
            usage = data.get("usageMetadata", {})
            return {
                "content": text,
                "model": clean_model,
                "prompt_tokens": usage.get("promptTokenCount", 0),
                "completion_tokens": usage.get("candidatesTokenCount", 0),
                "estimated_cost": 0.0001
            }

    async def _call_openrouter(self, messages: List[Dict[str, str]], model: str, temp: float, max_tokens: int) -> Dict[str, Any]:
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://chatpilot.local",
            "X-Title": "ChatPilot AI"
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temp,
            "max_tokens": max_tokens
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                # Try fallback key if available
                if settings.OPENROUTER_API_KEY_ALT:
                    headers["Authorization"] = f"Bearer {settings.OPENROUTER_API_KEY_ALT}"
                    resp2 = await client.post(url, headers=headers, json=payload)
                    if resp2.status_code == 200:
                        data = resp2.json()
                        usage = data.get("usage", {})
                        return {
                            "content": data["choices"][0]["message"]["content"].strip(),
                            "model": data.get("model", model),
                            "prompt_tokens": usage.get("prompt_tokens", 0),
                            "completion_tokens": usage.get("completion_tokens", 0),
                            "estimated_cost": 0.00005
                        }
                raise Exception(f"OpenRouter API error {resp.status_code}: {resp.text}")
            data = resp.json()
            usage = data.get("usage", {})
            return {
                "content": data["choices"][0]["message"]["content"].strip(),
                "model": data.get("model", model),
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "estimated_cost": 0.00005
            }

    async def analyze_multimodal(
        self,
        prompt: str,
        mime_type: str,
        file_base64: str,
        model_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Multimodal analysis for images, PDF, and audio using Gemini 1.5 Flash.
        Supports:
          - Images (JPEG, PNG, WebP): Reads text/diagrams/screenshots
          - PDF / Notes: Extracts and understands document layout & contents
          - Audio / Video: Analyzes spoken or visual content
        """
        clean_model = (model_name or "gemini-1.5-flash").replace("models/", "")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent?key={settings.GEMINI_API_KEY}"
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt or "Analyze and explain this content in detail:"},
                        {
                            "inlineData": {
                                "mimeType": mime_type,
                                "data": file_base64
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 1000
            }
        }
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise Exception(f"Gemini Multimodal error {resp.status_code}: {resp.text}")
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates or "content" not in candidates[0]:
                raise Exception("Gemini returned empty candidate for multimodal analysis")
            analysis_text = candidates[0]["content"]["parts"][0]["text"].strip()
            return {
                "success": True,
                "content": analysis_text,
                "model": clean_model,
                "mime_type": mime_type
            }

    async def transcribe_audio(self, audio_bytes: bytes, filename: str = "audio.wav") -> Dict[str, Any]:
        """
        Transcribes voice messages and voice inputs using Groq Whisper.
        Model: whisper-large-v3-turbo (lightning-fast, high accuracy across English, Tanglish, and global languages).
        """
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}"
        }
        files = {
            "file": (filename, audio_bytes, "audio/wav")
        }
        data = {
            "model": "whisper-large-v3-turbo",
            "response_format": "json"
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, data=data, files=files)
            if resp.status_code != 200:
                data["model"] = "whisper-large-v3"
                resp2 = await client.post(url, headers=headers, data=data, files=files)
                if resp2.status_code != 200:
                    raise Exception(f"Groq Whisper error {resp.status_code}: {resp.text}")
                resp = resp2
            res_data = resp.json()
            transcription = (res_data.get("text") or "").strip()
            return {
                "success": True,
                "text": transcription,
                "model": data["model"]
            }

    def _log_usage(self, provider_name: str, model_name: str, request_status: str, prompt_tokens: int, completion_tokens: int, estimated_cost: float, latency_ms: int, error_code: Optional[str] = None):
        try:
            self.supabase.table("ai_usage_logs").insert({
                "owner_id": settings.DEFAULT_OWNER_ID,
                "provider_name": provider_name,
                "model_name": model_name,
                "request_status": request_status,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "estimated_cost": estimated_cost,
                "latency_ms": latency_ms,
                "error_code": error_code
            }).execute()
        except Exception as e:
            logger.error(f"Error logging AI usage: {e}")

ai_manager = AIProviderManager()
