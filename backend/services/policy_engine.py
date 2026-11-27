import re
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

class PolicyClassification(BaseModel):
    category: str
    risk_level: str  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    action: str      # "draft", "hold", "require_approval", "never_send"
    requires_approval: bool
    confidence: float
    rationale: str
    recommended_holding_draft: Optional[str] = None
    flags: List[str] = []

class ResponsePolicyEngine:
    """
    12-Category Safety First Decision Engine.
    Evaluates incoming WhatsApp message content as untrusted input.
    """

    HIGH_RISK_KEYWORDS = [
        r"\botp\b", r"\bpassword\b", r"\bpin\b", r"\bcvv\b", r"\bdebit\s*card\b", 
        r"\bcredit\s*card\b", r"\bbank\s*account\b", r"\bupi\s*pin\b", r"\bnetbanking\b",
        r"\bwire\s*transfer\b", r"\bsecret\s*key\b", r"\bprivate\s*key\b"
    ]

    EMERGENCY_KEYWORDS = [
        r"\bhospital\b", r"\bemergency\b", r"\bambulance\b", r"\baccident\b",
        r"\bblood\s*required\b", r"\bicu\b", r"\bpolice\b", r"\burgent\s*help\b"
    ]

    FINANCIAL_KEYWORDS = [
        r"\bgpay\b", r"\bphonepe\b", r"\bpaytm\b", r"\btransfer\s*money\b", r"\bsend\s*rs\b",
        r"\brupees\b", r"\baccount\s*number\b", r"\bifsc\b", r"\bloan\b", r"\bemi\b"
    ]

    COMMITMENT_KEYWORDS = [
        r"\bpromise\b", r"\bwill\s*pay\b", r"\bconfirm\s*booking\b", r"\bdeal\s*done\b",
        r"\bsigning\b", r"\bguarantee\b", r"\bagreed\s*to\s*pay\b"
    ]

    DECISION_KEYWORDS = [
        r"\bdecide\b", r"\bapproval\b", r"\bapprove\b", r"\byour\s*call\b",
        r"\bwhat\s*do\s*you\s*say\b", r"\bshall\s*we\s*proceed\b", r"\byes\s*or\s*no\b"
    ]

    INVITATION_KEYWORDS = [
        r"\bwedding\b", r"\bparty\b", r"\bdinner\b", r"\blunch\b", r"\bmeet\s*up\b",
        r"\bcome\s*over\b", r"\bget\s*together\b", r"\binvited\b", r"\bjoin\s*us\b"
    ]

    SCHEDULING_KEYWORDS = [
        r"\bfree\s*at\b", r"\bavailable\s*tomorrow\b", r"\btime\s*slot\b", r"\bwhat\s*time\b",
        r"\bwhen\s*can\s*we\s*meet\b", r"\bcalendar\b", r"\bschedule\b"
    ]

    MEDIA_PLACEHOLDERS = [
        r"<media\s*omitted>", r"<image\s*omitted>", r"<video\s*omitted>", 
        r"<audio\s*omitted>", r"<document\s*omitted>", r"<voice\s*message\s*omitted>"
    ]

    def classify_message(self, text: str) -> PolicyClassification:
        clean_text = text.lower().strip()

        # 1. Check for Emergency / Urgent
        for kw in self.EMERGENCY_KEYWORDS:
            if re.search(kw, clean_text):
                return PolicyClassification(
                    category="emergency",
                    risk_level="CRITICAL",
                    action="require_approval",
                    requires_approval=True,
                    confidence=0.95,
                    rationale=f"Urgent emergency keyword detected ({kw}). Immediate human attention required.",
                    recommended_holding_draft="I just saw your urgent message. Contacting Thoufikur immediately.",
                    flags=["EMERGENCY_ALERT", "HIGH_PRIORITY_INBOX"]
                )

        # 2. Check for High-Risk Credential / Security
        for kw in self.HIGH_RISK_KEYWORDS:
            if re.search(kw, clean_text):
                return PolicyClassification(
                    category="sensitive",
                    risk_level="HIGH",
                    action="never_send",
                    requires_approval=True,
                    confidence=0.99,
                    rationale=f"Security-critical credential keyword matched ({kw}). Auto-reply blocked.",
                    recommended_holding_draft=None,
                    flags=["SECURITY_CREDENTIAL_DETECTED", "AUTO_REPLY_BLOCKED"]
                )

        # 3. Check for Financial / Payment
        for kw in self.FINANCIAL_KEYWORDS:
            if re.search(kw, clean_text):
                return PolicyClassification(
                    category="financial",
                    risk_level="HIGH",
                    action="require_approval",
                    requires_approval=True,
                    confidence=0.90,
                    rationale="Financial transaction or payment query detected. Requires explicit user authorization.",
                    recommended_holding_draft="I'll check the payment details with Thoufikur and confirm.",
                    flags=["FINANCIAL_ACTION_REQUIRED"]
                )

        # 4. Check for Commitment / Promise
        for kw in self.COMMITMENT_KEYWORDS:
            if re.search(kw, clean_text):
                return PolicyClassification(
                    category="commitment",
                    risk_level="HIGH",
                    action="require_approval",
                    requires_approval=True,
                    confidence=0.88,
                    rationale="Commitment or legally binding promise detected. AI cannot commit without approval.",
                    recommended_holding_draft="Let me review this and get back to you with confirmation.",
                    flags=["COMMITMENT_GATE"]
                )

        # 5. Check for Decision / Approval
        for kw in self.DECISION_KEYWORDS:
            if re.search(kw, clean_text):
                return PolicyClassification(
                    category="decision",
                    risk_level="HIGH",
                    action="require_approval",
                    requires_approval=True,
                    confidence=0.85,
                    rationale="Decision or policy choice requested. Cannot make arbitrary decisions.",
                    recommended_holding_draft="I need to think this through and update you shortly.",
                    flags=["DECISION_PENDING"]
                )

        # 6. Check for Invitation / Event
        for kw in self.INVITATION_KEYWORDS:
            if re.search(kw, clean_text):
                return PolicyClassification(
                    category="invitation",
                    risk_level="MEDIUM",
                    action="require_approval",
                    requires_approval=True,
                    confidence=0.85,
                    rationale="Event or meeting invitation detected. Requires schedule confirmation.",
                    recommended_holding_draft="Thanks for the invite! Let me check my schedule and confirm.",
                    flags=["INVITATION_NEEDS_CONFIRMATION"]
                )

        # 7. Check for Scheduling / Availability
        for kw in self.SCHEDULING_KEYWORDS:
            if re.search(kw, clean_text):
                return PolicyClassification(
                    category="scheduling",
                    risk_level="MEDIUM",
                    action="require_approval",
                    requires_approval=True,
                    confidence=0.82,
                    rationale="Scheduling query detected. Never invent availability without approval.",
                    recommended_holding_draft="Let me check my calendar and let you know what time works.",
                    flags=["SCHEDULING_PENDING"]
                )

        # 8. Check for Media placeholders
        for kw in self.MEDIA_PLACEHOLDERS:
            if re.search(kw, clean_text):
                return PolicyClassification(
                    category="media_document",
                    risk_level="MEDIUM",
                    action="require_approval",
                    requires_approval=True,
                    confidence=0.90,
                    rationale="Media placeholder detected. Text-only exports do not contain binary image bytes.",
                    recommended_holding_draft="Got the file/media. I'll take a look and reply soon.",
                    flags=["MEDIA_PLACEHOLDER"]
                )

        # 9. Casual / Greeting (Default fallback)
        return PolicyClassification(
            category="casual",
            risk_level="LOW",
            action="draft",
            requires_approval=True,  # Approval mode is default across all contacts
            confidence=0.90,
            rationale="Standard casual or conversational message. Personalized reply draft recommended in approval queue.",
            recommended_holding_draft=None,
            flags=["APPROVAL_QUEUE_ACTIVE"]
        )

policy_engine = ResponsePolicyEngine()
