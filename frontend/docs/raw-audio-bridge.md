Raw Audio Bridge (Vapi Listen -> MERaLiON -> Vapi Control)

Goal

- Bypass transcript-only custom LLM flow.
- Feed raw call audio into MERaLiON so multilingual cues are preserved.
- Start bridge automatically when Vapi webhook sends call-started.

What was added

- Script: frontend/scripts/vapi-audio-bridge.mjs
- NPM command: npm run audio:bridge -- --call-id=<CALL_ID>
- Auto-start manager: frontend/app/lib/audio-bridge.ts
- Webhook integration: frontend/app/api/webhook/vapi/route.ts

Required environment variables

- VAPI_API_KEY: Vapi private key
- MERALION_API_KEY: MERaLiON API key
- VAPI_LISTEN_WS_URL_TEMPLATE (optional): legacy static template with {callId}
  - Recommended: leave unset and let bridge resolve from GET /call/{callId} -> monitor.listenUrl
- Optional:
  - MERALION_BASE_URL (default: http://meralion.org:8010/v1)
  - MERALION_MODEL (default: MERaLiON/MERaLiON-3-10B)
  - BRIDGE_SAMPLE_RATE (default: 16000)
  - BRIDGE_CHUNK_SECONDS (default: 4)
  - MERALION_LANGUAGE_HINT
  - BRIDGE_DEBUG_WAV_PATH (write one debug wav file)
  - BRIDGE_LOG_DIR (defaults to OS temp dir; avoids Next.js Fast Refresh loops)

How to run

1. Install dependencies from frontend:
   npm.cmd install

2. Export env vars (PowerShell example):
   $env:VAPI_API_KEY="..."
   $env:MERALION_API_KEY="..."

# Optional fallback only:

# $env:VAPI_LISTEN_WS_URL_TEMPLATE="wss://<YOUR-VAPI-LISTEN-ENDPOINT>/{callId}"

3. Start your Vapi call and get its call ID.

4. Automatic mode (recommended):
   Ensure Vapi webhook points to /api/webhook/vapi and includes call-started events.
   The server will spawn one bridge process per call automatically.

5. Manual mode (fallback):
   npm.cmd run audio:bridge -- --call-id=<CALL_ID>

How it works

- Connects to Vapi listen websocket and receives audio frames.
- Buffers PCM chunks into short windows.
- Wraps PCM into WAV and sends to MERaLiON chat/completions as audio_url.
- Parses response JSON and sends response_text back using Vapi call control endpoint:
  POST https://api.vapi.ai/call/<CALL_ID>/control with { type: "say", text: "..." }.

Important integration notes

- Vapi listen payload shape can vary by account/provider settings.
  The script tries common fields (audio, data.audio, chunk.audio, payload.audio).
  If your payload is different, update parseAudioBufferFromMessage in the script.

- Listen URL resolution order:
  1. If VAPI_LISTEN_WS_URL_TEMPLATE includes {callId}, use it.
  2. Otherwise fetch GET /call/{callId} and use call.monitor.listenUrl.

- This script is middleware-only and should run as a separate process.
  Do not run this in browser code.

Production hardening checklist

- Use one bridge process per call.
- Add VAD/turn detection before inference to avoid interrupting users.
- Keep a rolling conversation state for better responses.
- Persist transcripts/metadata to Supabase from bridge output.
- Add retries and exponential backoff for both MERaLiON and Vapi control APIs.
- Store secrets only in server env vars.
- Consider writing bridge logs to a file (current webhook-spawn mode uses stdio=ignore).
