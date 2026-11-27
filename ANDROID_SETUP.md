# Native Android Notification Companion Setup (Future Integration)

## Architecture
```
[Android Device]
  └── WhatsApp Notification arrives
        └── NotificationListenerService captures sender & text
              └── POST http://<windows-host-ip>:8000/api/webhooks/whatsapp
                    └── FastAPI backend processes incoming message
                          └── Reply generated & surfaced in Reply Inbox
```

## Implementation Plan
1. Built-in Android Kotlin service extending `NotificationListenerService`.
2. Secure pairing with Windows host via local LAN IP or ngrok/Cloudflare tunnel.
3. Diagnostics and permission revocation controls from Android Settings.
