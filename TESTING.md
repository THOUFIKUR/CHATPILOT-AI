# Testing Guide

## 1. AI Provider Connection Test
Verify all three providers directly:
```powershell
python -c "import urllib.request, json
for prov in ['groq', 'gemini', 'openrouter']:
    data = json.dumps({'provider_name': prov}).encode()
    req = urllib.request.Request('http://127.0.0.1:8000/api/ai/test', data=data, headers={'Content-Type': 'application/json'})
    print(prov, ':', urllib.request.urlopen(req).read().decode())
"
```

## 2. Windows Message Simulator Test
Simulate an incoming message:
```powershell
python -c "import urllib.request, json
req_data = json.dumps({'sender_name': 'Rahul', 'message': 'File send pannalama da?'}).encode('utf-8')
req = urllib.request.Request('http://127.0.0.1:8000/api/diagnostics/simulate', data=req_data, headers={'Content-Type': 'application/json'})
print(json.loads(urllib.request.urlopen(req).read().decode()))
"
```

## 3. High-Risk Safety Guardrail Test
```powershell
python -c "import urllib.request, json
req_data = json.dumps({'sender_name': 'Bank Alert', 'message': 'Your bank OTP is 492019'}).encode('utf-8')
req = urllib.request.Request('http://127.0.0.1:8000/api/diagnostics/simulate', data=req_data, headers={'Content-Type': 'application/json'})
print(json.loads(urllib.request.urlopen(req).read().decode()))
"
```
Expects: `{'blocked': True, 'reason': 'High risk content (OTP/financial/password)'}`
