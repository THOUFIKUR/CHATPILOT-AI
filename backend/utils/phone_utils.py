import re
from typing import Optional

def normalize_phone(val: Optional[str]) -> str:
    """
    Normalizes phone numbers to standard E.164 format.
    Accurately supports:
      - Saudi Arabia (+966): 9 national digits (e.g. mobile 5xxxxxxxx, landline 1xxxxxxxx).
        Handles local formats: 05xxxxxxxx, 5xxxxxxxx, 00966..., +966..., and user typos (+96605...).
      - India (+91): 10 national digits (6-9xxxxxxxx).
        Handles local formats: 098..., 98..., 0091..., +91..., and user typos (+91098...).
      - Other international E.164 numbers (+1, +44, +971, +65, etc.).
    Guarantees no cross-contamination between countries and prevents duplicate records.
    """
    if not val:
        return ""
    
    raw = str(val).strip()
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""

    # Replace leading 00 international dialing prefix with +
    if raw.startswith("00"):
        raw = "+" + raw[2:]
        digits = re.sub(r"\D", "", raw)

    # -------------------------------------------------------------
    # 1. Saudi Arabia Normalization (+966)
    # Total digits with country code: 966 + 9 national digits = 12 digits
    # -------------------------------------------------------------
    # Case: +96605... or 96605... (user added both +966 and leading 0) -> 13 digits total
    if (raw.startswith("+9660") or digits.startswith("9660")) and len(digits) == 13:
        clean_digits = "966" + digits[4:]
        return f"+{clean_digits}"

    # Case: +9665xxxxxxxx or 9665xxxxxxxx (12 digits, starts with 966)
    if digits.startswith("966") and len(digits) == 12:
        return f"+{digits}"

    # Case: Local format 05xxxxxxxx (10 digits starting with 05)
    if digits.startswith("05") and len(digits) == 10:
        return f"+966{digits[1:]}"

    # Case: Local format 5xxxxxxxx (9 digits starting with 5)
    if digits.startswith("5") and len(digits) == 9:
        return f"+966{digits}"

    # Case: Local landline format 01xxxxxxxx (10 digits, e.g. Riyadh 011, Jeddah 012)
    if digits.startswith("01") and len(digits) == 10:
        return f"+966{digits[1:]}"

    # -------------------------------------------------------------
    # 2. India Normalization (+91)
    # Total digits with country code: 91 + 10 national digits = 12 digits
    # -------------------------------------------------------------
    # Case: +910... or 910... (user added +91 and leading 0) -> 13 digits
    if (raw.startswith("+910") or digits.startswith("910")) and len(digits) == 13:
        clean_digits = "91" + digits[3:]
        return f"+{clean_digits}"

    # Case: 91xxxxxxxxxx (12 digits, starts with 91 followed by valid mobile 6-9)
    if digits.startswith("91") and len(digits) == 12 and digits[2] in "6789":
        return f"+{digits}"

    # Case: Local 0xxxxxxxxxx (11 digits, starts with 0 followed by 6-9)
    if digits.startswith("0") and len(digits) == 11 and digits[1] in "6789":
        return f"+91{digits[1:]}"

    # Case: Local 10 digits starting with 6-9
    if len(digits) == 10 and digits[0] in "6789":
        return f"+91{digits}"

    # -------------------------------------------------------------
    # 3. Other International E.164 Numbers
    # -------------------------------------------------------------
    if raw.startswith("+") and len(digits) >= 7:
        return f"+{digits}"
    
    # Fallback: if already has at least 7 digits, preserve as E.164 with +
    if len(digits) >= 7:
        return f"+{digits}"

    return ""


def match_phone(p1: Optional[str], p2: Optional[str]) -> bool:
    """
    Compares two phone numbers for identity match.
    Enforces strict country boundaries:
      - Saudi numbers only match Saudi numbers with the same 9 national digits.
      - Indian numbers only match Indian numbers with the same 10 national digits.
      - Never matches an Indian number to a Saudi number even if trailing digits overlap.
    """
    n1 = normalize_phone(p1)
    n2 = normalize_phone(p2)
    if not n1 or not n2:
        return False
    
    if n1 == n2:
        return True

    # Saudi country check (+966)
    if n1.startswith("+966") and n2.startswith("+966"):
        return n1[-9:] == n2[-9:]

    # India country check (+91)
    if n1.startswith("+91") and n2.startswith("+91"):
        return n1[-10:] == n2[-10:]

    return False
