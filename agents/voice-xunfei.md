# Voice / Xunfei STT

## Architecture
- Frontend: `web/src/components/VoiceInput.tsx` (getUserMedia + WS `/ws/speech`)
- Backend: `server/services/speech.js` (proxy to Xunfei)
- Debug page: `TmuxWeb/web/public/voice-debug.html` → `http://localhost:5216/voice-debug.html`

## Configuration
In `TmuxWeb/server/config.json`:
```json
{
  "xunfei": {
    "appId": "xxx",
    "apiKey": "xxx",
    "apiSecret": "xxx"
  }
}
```
