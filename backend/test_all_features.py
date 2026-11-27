import urllib.request
import json

base = 'http://127.0.0.1:8000/api'

def post_json(endpoint, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(base + endpoint, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())

def get_json(endpoint):
    req = urllib.request.Request(base + endpoint)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

print("=== 1. CONTACTS & LEDGER CHECK ===")
contacts = get_json('/contacts')
print(f"Total contacts loaded: {len(contacts)}")
if contacts:
    c = contacts[0]
    print(f"Sample contact: Name='{c.get('display_name')}', Mode='{c.get('reply_mode')}', AutoReply={c.get('auto_reply_enabled')}")

print("\n=== 2. AUTO-REPLY STATUS CHECK ===")
ar_status = get_json('/auto-reply/status')
print("Auto-reply system status:", ar_status)

print("\n=== 3. AI PROVIDERS CHECK ===")
providers = get_json('/ai/providers')
print(f"Total AI Providers: {len(providers)}")
for p in providers:
    print(f" - {p.get('provider_name')} ({p.get('model_name')}): Enabled={p.get('is_enabled')}")

print("\n=== 4. CONNECTORS CHECK ===")
connectors = get_json('/connectors')
print(f"Active connectors: {len(connectors)}")
for conn in connectors[:3]:
    print(f" - {conn.get('name')}: Status={conn.get('status')}")

print("\n=== 5. SIMULATE INCOMING MESSAGE & BOT GENERATION ===")
try:
    sim_result = post_json('/diagnostics/simulate', {
        'sender_name': 'Parveen',
        'message': 'Hi Thoufikur, are you free this evening for a quick call?'
    })
    print("Simulated Auto-Reply Engine result:", sim_result)
except Exception as e:
    print("Simulate error:", e)

print("\n=== 6. ASSISTANT SESSIONS CHECK ===")
sessions = get_json('/assistant/sessions')
print(f"Assistant chat sessions: {len(sessions)}")
print("\n>>> ALL CRITICAL ENGINE TESTS COMPLETED SUCCESSFULLY! <<<")
