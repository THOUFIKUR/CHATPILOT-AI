import requests

BASE = "http://127.0.0.1:8000"

# 1. Health & Auto-reply status
status = requests.get(f"{BASE}/api/auto-reply/status").json()
print("Auto-reply status:", status)
assert status["auto_reply_enabled"] is False, "Auto-reply should be False initially"
assert status["status_label"] == "AUTO-REPLY PAUSED", f"Unexpected text: {status}"

# 2. Check active device endpoint
active_dev = requests.get(f"{BASE}/api/auth/active-device").json()
print("Active device:", active_dev)

# 3. Test validate session with dummy id
val_res = requests.post(f"{BASE}/api/auth/validate-session", json={"device_identifier": "non-existent"})
print("Validate dummy session status:", val_res.status_code, val_res.json())
assert val_res.status_code == 401, f"Expected 401, got {val_res.status_code}"
assert val_res.json()["detail"] == "session_revoked_by_another_device"

# 4. Check contacts API
contacts = requests.get(f"{BASE}/api/contacts").json()
parveen = next((c for c in contacts if c.get("display_name") == "Parveen"), None)
print(f"Total contacts: {len(contacts)}, Parveen selected: {parveen.get('is_selected')}, auto_reply: {parveen.get('auto_reply_enabled')}, mode: {parveen.get('reply_mode')}")
assert parveen is not None, "Parveen contact must exist"
assert parveen.get("is_selected") is True, "Parveen must be selected"
assert parveen.get("reply_mode") == "automatic", "Parveen must be automatic"

print("\nALL BACKEND AUTH & CONTACT POLICIES VERIFIED SUCCESSFULLY!")
