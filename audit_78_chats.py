import zipfile
import re
import json

zip_path = r"D:\CHATPILOT AI\ChatPilot_WhatsApp_Analysis_Package.zip"

WHATSAPP_LINE_PATTERNS = [
    re.compile(r"^\[?(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[APap][Mm])?)\]?(?:\s*-\s*)?([^:]+):\s*(.*)$"),
    re.compile(r"^(\d{4}[/.-]\d{1,2}[/.-]\d{1,2}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[APap][Mm])?)(?:\s*-\s*)?([^:]+):\s*(.*)$")
]

GROUP_SYS_PATTERNS = [
    re.compile(r"created group", re.I),
    re.compile(r"added \+?\d+", re.I),
    re.compile(r"joined using this group", re.I),
    re.compile(r"changed the group description", re.I),
    re.compile(r"changed the subject to", re.I),
    re.compile(r"left$", re.I),
    re.compile(r"removed \+?\d+", re.I)
]

with zipfile.ZipFile(zip_path, "r") as z:
    txt_files = [f for f in z.namelist() if f.endswith(".txt")]
    
    results = []
    for fpath in sorted(txt_files):
        fname = fpath.split("/")[-1]
        content = z.read(fpath).decode("utf-8", errors="replace")
        lines = content.splitlines()
        
        senders = set()
        group_indicators = []
        msg_count = 0
        
        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue
            
            for gp in GROUP_SYS_PATTERNS:
                if gp.search(line_str):
                    group_indicators.append(line_str[:60])
            
            for pat in WHATSAPP_LINE_PATTERNS:
                m = pat.match(line_str)
                if m:
                    date_part, time_part, sender, text = m.groups()
                    sender = sender.strip()
                    if "Messages and calls are end-to-end encrypted" not in sender:
                        senders.add(sender)
                        msg_count += 1
                    break
                    
        # Precise Classification
        if len(group_indicators) > 0:
            classification = "Group Chat / Group Indicators"
        elif len(senders) > 2:
            classification = "Ambiguous Multi-Sender"
        elif len(senders) == 1:
            classification = "Single-Participant Export"
        elif len(senders) == 2:
            classification = "Confirmed 1-on-1"
        else:
            classification = "Empty / Unparseable"
            
        results.append({
            "file": fname,
            "msg_count": msg_count,
            "senders": sorted(list(senders)),
            "sender_count": len(senders),
            "group_indicators": len(group_indicators),
            "group_samples": group_indicators[:3],
            "classification": classification
        })

print(f"Total TXT exports analyzed: {len(results)}")
by_class = {}
for r in results:
    c = r["classification"]
    by_class[c] = by_class.get(c, 0) + 1

print("\nCLASSIFICATION BREAKDOWN:")
for c, cnt in by_class.items():
    print(f"  {c}: {cnt}")

print("\nDETAILS OF ANY NON-CONFIRMED 1-ON-1 CHATS:")
for r in results:
    if r["classification"] != "Confirmed 1-on-1":
        print(f"File: {r['file']}")
        print(f"  Classification: {r['classification']}")
        print(f"  Sender Count: {r['sender_count']}")
        print(f"  Senders: {r['senders']}")
        print(f"  Group Indicators: {r['group_indicators']} (Samples: {r['group_samples']})")

with open(r"D:\CHATPILOT AI\audit_78_chats_results.json", "w", encoding="utf-8") as out:
    json.dump(results, out, indent=2, ensure_ascii=False)
print("\nWrote audit_78_chats_results.json")
