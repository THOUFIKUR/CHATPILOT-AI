import urllib.request
import json
import sys

def post(url, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def get(url):
    with urllib.request.urlopen(url) as r:
        return json.loads(r.read().decode())

print("--- ChatPilot AI Live Verification Suite ---")

h = get("http://127.0.0.1:8000/api/health")
print("1. Health Endpoint:", h["status"])
assert h["status"] == "healthy"

p1 = post("http://127.0.0.1:8000/api/dataset/policy/classify", {"message": "Please send OTP or bank account number for transfer"})
print("2. Financial / OTP Policy:", p1["category"], "| Risk:", p1["risk_level"], "| Action:", p1["action"])
assert p1["risk_level"] in ("HIGH", "CRITICAL")
assert p1["action"] == "never_send"

p2 = post("http://127.0.0.1:8000/api/dataset/policy/classify", {"message": "Help urgent accident in hospital need blood"})
print("3. Emergency Health Policy:", p2["category"], "| Risk:", p2["risk_level"], "| Action:", p2["action"])
assert p2["risk_level"] in ("HIGH", "CRITICAL")

p3 = post("http://127.0.0.1:8000/api/dataset/policy/classify", {"message": "Hey bro, college project ppt ready ah? Tomorrow submit pannalam"})
print("4. Casual Tanglish Policy:", p3["category"], "| Risk:", p3["risk_level"], "| Action:", p3["action"])
assert p3["risk_level"] == "LOW"

sp = get("http://127.0.0.1:8000/api/dataset/style-profiles")
print("5. Style Profiles Endpoint Connected. Live rows:", len(sp))

rel = get("http://127.0.0.1:8000/api/dataset/relationships")
print("6. Relationships Endpoint Connected. Live rows:", len(rel))

dry = get("http://127.0.0.1:8000/api/dataset/dry-run")
print("7. Dataset Dry Run Ready. Discovered Chats:", dry["summary"]["total_discovered_chats"], "| Records:", dry["summary"]["total_records"])
assert dry["summary"]["total_discovered_chats"] == 78

print("\nALL VERIFICATION CHECKS PASSED PERFECTLY!")
