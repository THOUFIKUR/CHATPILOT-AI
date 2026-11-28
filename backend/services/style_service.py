import re
from typing import List, Dict, Any
from database import get_supabase
import logging

logger = logging.getLogger(__name__)

# Common Tanglish / Tamil slang keywords
TANGLISH_KEYWORDS = {
    "da", "machi", "machan", "bro", "seri", "vaa", "va", "pa", "naan",
    "enna", "solren", "solra", "pannalama", "panna", "ippo", "aama",
    "illa", "paravala", "pathukalam", "vandhuten", "poren", "kelambiten"
}

class StyleLearner:
    def __init__(self):
        self.supabase = get_supabase()

    def analyze_samples(self, samples: List[str]) -> Dict[str, Any]:
        """Analyze a list of outgoing messages to identify writing patterns."""
        if not samples:
            return {
                "detected_languages": ["Tanglish / English"],
                "tone": "Casual and natural",
                "sentence_length": "Short and concise",
                "slang_tags": ["Natural text", "Short replies"],
                "top_emojis": [],
                "example_samples": [],
                "summary": "Natural WhatsApp texting style."
            }

        total_words = 0
        total_chars = 0
        tanglish_count = 0
        emojis_found = []
        punctuation_patterns = {"exclamation": 0, "ellipsis": 0, "question": 0}
        detected_slang = set()
        clean_examples = []

        for s in samples:
            text = s.strip()
            if not text or "<Media" in text:
                continue
            if len(clean_examples) < 6 and len(text) > 3:
                clean_examples.append(text)

            total_chars += len(text)
            words = re.findall(r"\b\w+\b", text.lower())
            total_words += len(words)

            for w in words:
                if w in TANGLISH_KEYWORDS:
                    tanglish_count += 1
                    detected_slang.add(w)

            # Emojis
            emojis = re.findall(r"[\U00010000-\U0010ffff]", text)
            emojis_found.extend(emojis)

            # Punctuation
            if "!" in text:
                punctuation_patterns["exclamation"] += 1
            if "..." in text or ".." in text:
                punctuation_patterns["ellipsis"] += 1
            if "?" in text:
                punctuation_patterns["question"] += 1

        avg_words_per_msg = total_words / max(len(samples), 1)

        # Determine language profile
        if tanglish_count > 1:
            language_tag = "Tamil + English (Tanglish)"
        else:
            language_tag = "Tanglish / English"

        # Determine length
        if avg_words_per_msg < 6:
            length_tag = "Short (1-6 words)"
        elif avg_words_per_msg < 15:
            length_tag = "Moderate (6-15 words)"
        else:
            length_tag = "Detailed replies"

        # Formality
        tone = "Casual and relaxed"
        if "da" in detected_slang or "machi" in detected_slang:
            tone = "Very casual & friendly"

        slang_pills = [language_tag, length_tag]
        slang_list = list(detected_slang)[:4]
        if slang_list:
            formatted_slang = ", ".join(f"'{s}'" for s in slang_list)
            slang_pills.append(f"Uses {formatted_slang}")

        # Top emojis
        from collections import Counter
        top_emojis = [e for e, _ in Counter(emojis_found).most_common(5)]

        return {
            "detected_languages": [language_tag],
            "tone": tone,
            "sentence_length": length_tag,
            "slang_tags": slang_pills,
            "total_samples": len(samples),
            "top_slang": list(detected_slang),
            "top_emojis": top_emojis,
            "example_samples": clean_examples,
            "summary": f"Speaks mostly in {language_tag} with {length_tag.lower()}. Tone is {tone.lower()}."
        }

    def get_contact_style(self, contact_id: str) -> Dict[str, Any]:
        """Fetch writing samples for contact and synthesize style."""
        res = self.supabase.table("writing_samples")\
            .select("sample_text")\
            .eq("contact_id", contact_id)\
            .limit(100)\
            .execute()
        
        samples = [r["sample_text"] for r in (res.data or []) if r.get("sample_text")]
        
        # Fallback to outgoing messages if writing_samples is empty
        if not samples:
            conv_res = self.supabase.table("conversations").select("id").eq("contact_id", contact_id).execute()
            if conv_res.data:
                convo_id = conv_res.data[0]["id"]
                msg_res = self.supabase.table("messages")\
                    .select("body")\
                    .eq("conversation_id", convo_id)\
                    .eq("direction", "outgoing")\
                    .neq("body", "<Media omitted>")\
                    .limit(50)\
                    .execute()
                samples = [m["body"] for m in (msg_res.data or []) if m.get("body")]

        return self.analyze_samples(samples)

style_service = StyleLearner()
