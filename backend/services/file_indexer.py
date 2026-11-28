import os
import re
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Engineering / Subject acronyms mapping to full subject names
SUBJECT_ACRONYMS = {
    "pe": ["power electronics", "professional ethics", "physical education"],
    "dsp": ["digital signal processing"],
    "vlsi": ["very large scale integration"],
    "edc": ["electronic devices and circuits"],
    "lic": ["linear integrated circuits"],
    "cs": ["control systems", "computer science"],
    "emf": ["electromagnetic fields"],
    "dbms": ["database management systems"],
    "os": ["operating systems"],
    "cns": ["cryptography and network security"],
    "ai": ["artificial intelligence"],
    "ml": ["machine learning"],
    "dsa": ["data structures and algorithms"],
    "oops": ["object oriented programming"],
    "ca": ["computer architecture"],
    "mpmc": ["microprocessors and microcontrollers"],
    "pom": ["principles of management"]
}

class FileIndexerService:
    def __init__(self, index_file_path: str = "backend/data/file_index.json"):
        self.index_file_path = index_file_path
        self._index: List[Dict[str, Any]] = []
        self._load_index()

    def _load_index(self):
        """Loads cached index from JSON file or initializes empty."""
        try:
            if os.path.exists(self.index_file_path):
                with open(self.index_file_path, "r", encoding="utf-8") as f:
                    self._index = json.load(f)
            else:
                self._index = []
        except Exception as e:
            logger.warning(f"Failed to load file index: {e}")
            self._index = []

    def _save_index(self):
        """Persists file index to JSON."""
        try:
            os.makedirs(os.path.dirname(self.index_file_path), exist_ok=True)
            with open(self.index_file_path, "w", encoding="utf-8") as f:
                json.dump(self._index, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save file index: {e}")

    def register_file(
        self,
        filename: str,
        file_path: str,
        mime_type: str = "application/pdf",
        tags: Optional[List[str]] = None,
        extracted_text: str = "",
        subject_keywords: Optional[List[str]] = None,
        file_size_bytes: int = 0
    ) -> Dict[str, Any]:
        """Indexes or updates a file in the searchable catalog."""
        # Derive subject keywords from filename and tags
        combined_keywords = set(subject_keywords or [])
        combined_keywords.add(filename.lower())
        name_clean = re.sub(r"[^\w\s]", " ", filename.lower())
        for token in name_clean.split():
            if len(token) >= 2:
                combined_keywords.add(token)
                if token in SUBJECT_ACRONYMS:
                    for full_name in SUBJECT_ACRONYMS[token]:
                        combined_keywords.add(full_name)

        entry = {
            "id": f"file_{len(self._index) + 1}_{int(datetime.now().timestamp())}",
            "filename": filename,
            "file_path": file_path,
            "mime_type": mime_type,
            "file_size_bytes": file_size_bytes or (os.path.getsize(file_path) if os.path.exists(file_path) else 1024),
            "tags": tags or ["study_notes"],
            "subject_keywords": list(combined_keywords),
            "extracted_text_preview": (extracted_text or filename)[:400],
            "last_indexed": datetime.now(timezone.utc).isoformat()
        }

        # Avoid duplicates by file_path
        self._index = [f for f in self._index if f.get("file_path") != file_path]
        self._index.append(entry)
        self._save_index()
        logger.info(f"Indexed file: {filename} with {len(combined_keywords)} subject keywords")
        return entry

    def extract_file_request(self, message_text: str) -> Optional[Dict[str, Any]]:
        """
        Detects if an incoming message is requesting notes, files, or documents.
        e.g. "Dai, send me the PE notes" -> returns query: "PE notes", acronym: "pe"
        """
        lower = message_text.lower()
        # Trigger patterns for document/notes requests
        patterns = [
            r"\b(send|share|give|forward|attach|provide)\b.*\b(notes|material|materials|pdf|doc|document|ppt|slides|syllabus|question bank|qb)\b",
            r"\b(notes|material|materials|pdf|doc|slides)\b.*\b(send|share|venum|kudunga|anupu|anupunga)\b"
        ]
        
        is_request = any(re.search(pat, lower) for pat in patterns)
        if not is_request:
            return None

        # Detect any subject acronyms
        found_acronym = None
        for word in re.findall(r"\b[a-zA-Z]{2,5}\b", message_text):
            w_lower = word.lower()
            if w_lower in SUBJECT_ACRONYMS:
                found_acronym = w_lower
                break

        return {
            "is_file_request": True,
            "raw_text": message_text,
            "detected_acronym": found_acronym,
            "inferred_subjects": SUBJECT_ACRONYMS.get(found_acronym, []) if found_acronym else []
        }

    def search_files(
        self,
        query: str,
        conversation_context: Optional[List[str]] = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Context-aware file search that ranks files by:
          1. Acronym expansion match (e.g. 'PE' -> 'Power Electronics')
          2. Filename keyword match
          3. Extracted text / notes content match
        """
        if not self._index:
            self._load_index()

        q_lower = query.lower()
        search_tokens = set(re.findall(r"\w+", q_lower))

        # Check for acronyms in query and expand them
        expanded_terms = set(search_tokens)
        for token in search_tokens:
            if token in SUBJECT_ACRONYMS:
                for full_name in SUBJECT_ACRONYMS[token]:
                    expanded_terms.add(full_name)
                    expanded_terms.update(full_name.split())

        # Also incorporate recent conversation context
        if conversation_context:
            for ctx in conversation_context[-5:]:
                for word in re.findall(r"\w+", ctx.lower()):
                    if word in SUBJECT_ACRONYMS:
                        for full_name in SUBJECT_ACRONYMS[word]:
                            expanded_terms.add(full_name)

        scored_results = []
        for file_item in self._index:
            score = 0
            fname_lower = file_item["filename"].lower()
            file_kw = [k.lower() for k in file_item.get("subject_keywords", [])]
            preview = file_item.get("extracted_text_preview", "").lower()

            for term in expanded_terms:
                if len(term) < 2:
                    continue
                # Direct match in filename
                if term in fname_lower:
                    score += 15
                # Match in subject keywords
                if any(term in kw for kw in file_kw):
                    score += 10
                # Match in content preview
                if term in preview:
                    score += 5

            if score > 0:
                scored_results.append({
                    "score": score,
                    "file": file_item
                })

        scored_results.sort(key=lambda x: x["score"], reverse=True)
        return [item["file"] for item in scored_results[:top_k]]

file_indexer = FileIndexerService()
