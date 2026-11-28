import re
from typing import Optional

def normalize_phone_e164(phone: Optional[str], default_country: str = "auto") -> str:
    """
    Normalizes a phone number to standard E.164 format (+<country_code><national_number>).
    
    Country Specific Rules:
    1. Saudi Arabia (+966):
       - National number is 9 digits (mobile usually starts with 5: 5xxxxxxxx).
       - Local format with leading zero: '05xxxxxxxx' (10 digits) -> '+9665xxxxxxxx'
       - Local format without leading zero: '5xxxxxxxx' (9 digits) -> '+9665xxxxxxxx'
       - With 00 prefix: '009665xxxxxxxx' -> '+9665xxxxxxxx'
       - Raw with country code: '9665xxxxxxxx' (12 digits) -> '+9665xxxxxxxx'
       - International with redundant zero: '+96605xxxxxxxx' -> '+9665xxxxxxxx'
       - Already E.164: '+9665xxxxxxxx' -> '+9665xxxxxxxx'
       
    2. India (+91):
       - National number is 10 digits (usually starts with 6, 7, 8, 9).
       - Local with leading zero: '09790171303' (11 digits) -> '+919790171303'
       - Local 10 digits: '9790171303' -> '+919790171303'
       - With 00 prefix: '00919790171303' -> '+919790171303'
       - Raw with country code: '919790171303' -> '+919790171303'
       - International with redundant zero: '+9109790171303' -> '+919790171303'
       - Already E.164: '+919790171303' -> '+919790171303'
       
    3. Other International numbers:
       - Preserved as +<digits> without corrupting length.
    """
    if not phone:
        return ""
        
    raw = phone.strip()
    if not raw:
        return ""
        
    has_plus = raw.startswith("+")
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""

    # Replace leading 00 with international indicator
    if digits.startswith("00"):
        digits = digits[2:]
        has_plus = True

    # 1. Check Saudi Arabia (+966)
    if digits.startswith("966"):
        sub = digits[3:]
        # Remove redundant leading zero: e.g. +96605... -> +9665...
        if sub.startswith("0"):
            sub = sub[1:]
        if len(sub) == 9:
            return f"+966{sub}"
        return f"+966{sub}"
    elif (not has_plus and digits.startswith("05") and len(digits) == 10) or (has_plus and digits.startswith("05") and len(digits) == 10):
        # Local Saudi mobile format 05xxxxxxxx -> +9665xxxxxxxx
        return f"+966{digits[1:]}"
    elif not has_plus and digits.startswith("5") and len(digits) == 9:
        # Saudi mobile national format 5xxxxxxxx -> +9665xxxxxxxx
        return f"+966{digits}"

    # 2. Check India (+91)
    if digits.startswith("91") and len(digits) in (12, 13):
        sub = digits[2:]
        if sub.startswith("0"):
            sub = sub[1:]
        if len(sub) == 10:
            return f"+91{sub}"
        return f"+91{sub}"
    elif not has_plus and digits.startswith("0") and len(digits) == 11 and digits[1] in "6789":
        # Local Indian format with leading 0: 09790171303 -> +919790171303
        return f"+91{digits[1:]}"
    elif not has_plus and len(digits) == 10 and digits[0] in "6789":
        # Standard Indian 10-digit mobile -> +919790171303
        return f"+91{digits}"

    # 3. Default fallback for other E.164 numbers
    return f"+{digits}"

def phones_match(phone_a: Optional[str], phone_b: Optional[str]) -> bool:
    """Returns True if two phone representations refer to the exact same phone number."""
    if not phone_a or not phone_b:
        return False
    norm_a = normalize_phone_e164(phone_a)
    norm_b = normalize_phone_e164(phone_b)
    if not norm_a or not norm_b:
        return False
    if norm_a == norm_b:
        return True
        
    # Check Saudi national 9 digits
    if norm_a.startswith("+966") and norm_b.startswith("+966"):
        return norm_a[4:] == norm_b[4:]
        
    # Check Indian national 10 digits
    if norm_a.startswith("+91") and norm_b.startswith("+91"):
        return norm_a[3:] == norm_b[3:]
        
    return False
