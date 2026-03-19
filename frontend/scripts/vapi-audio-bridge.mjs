import fs from "node:fs"
import process from "node:process"
import WebSocket from "ws"
import path from "node:path"
import os from "node:os"

/**
 * HealthLah raw-audio bridge:
 * Vapi listen websocket -> MERaLiON audio model -> Vapi call control (say)
 *
 * Usage:
 *   node scripts/vapi-audio-bridge.mjs --call-id=<vapi_call_id>
 */

const LOG_PREFIX = "[AudioBridge]"

const callIdFromArg = process.argv
  .find((a) => a.startsWith("--call-id="))
  ?.split("=")[1]

const callId = callIdFromArg || process.env.VAPI_CALL_ID || ""
const vapiApiKey = process.env.VAPI_API_KEY || ""
const meralionApiKey = process.env.MERALION_API_KEY || ""
const meralionBaseUrl = process.env.MERALION_BASE_URL || "http://meralion.org:8010/v1"
const meralionModel = process.env.MERALION_MODEL || "MERaLiON/MERaLiON-3-10B"

// Optional static template fallback. Recommended: leave empty and resolve dynamically via call.monitor.listenUrl.
const vapiListenUrlTemplate = process.env.VAPI_LISTEN_WS_URL_TEMPLATE || ""

const sampleRate = Number(process.env.BRIDGE_SAMPLE_RATE || 16000)
const chunkSeconds = Number(process.env.BRIDGE_CHUNK_SECONDS || 4)
const languageHint = process.env.MERALION_LANGUAGE_HINT || "Singapore English, Singlish, Mandarin, Malay, Tamil"

if (!callId) {
  console.error(`${LOG_PREFIX} Missing call id. Use --call-id=<id> or VAPI_CALL_ID env var.`)
  process.exit(1)
}

if (!vapiApiKey) {
  console.error(`${LOG_PREFIX} Missing VAPI_API_KEY.`)
  process.exit(1)
}

if (!meralionApiKey) {
  console.error(`${LOG_PREFIX} Missing MERALION_API_KEY.`)
  process.exit(1)
}

const pcmChunks = []
let bytesBuffered = 0
let isFlushing = false
const bridgeLogDir = process.env.BRIDGE_LOG_DIR || path.join(os.tmpdir(), "healthlah-bridge-logs")
const bridgeLogFile = path.join(bridgeLogDir, `${callId}.jsonl`)

if (!fs.existsSync(bridgeLogDir)) {
  fs.mkdirSync(bridgeLogDir, { recursive: true })
}

function writeBridgeLog(level, event, payload = {}) {
  const entry = {
    ts: new Date().toISOString(),
    callId,
    level,
    event,
    payload,
  }
  fs.appendFileSync(bridgeLogFile, `${JSON.stringify(entry)}\n`)
}

writeBridgeLog("info", "bridge-init", {
  sampleRate,
  chunkSeconds,
  meralionModel,
})

async function resolveListenUrl() {
  // Backward-compatible static template mode.
  if (vapiListenUrlTemplate && vapiListenUrlTemplate.includes("{callId}")) {
    return vapiListenUrlTemplate.replace("{callId}", callId)
  }

  // Some setups may explicitly set this placeholder to indicate dynamic resolution.
  if (vapiListenUrlTemplate && vapiListenUrlTemplate !== "{{call.monitor.listenUrl}}") {
    console.warn(`${LOG_PREFIX} VAPI_LISTEN_WS_URL_TEMPLATE does not include {callId}; ignoring and resolving dynamically.`)
  }

  const maxAttempts = 8
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`https://api.vapi.ai/call/${callId}`, {
      headers: {
        Authorization: `Bearer ${vapiApiKey}`,
      },
    })

    if (!res.ok) {
      const txt = await res.text()
      writeBridgeLog("warn", "call-details-fetch-failed", {
        attempt,
        status: res.status,
        body: txt,
      })
      await new Promise((r) => setTimeout(r, 1200))
      continue
    }

    const call = await res.json()
    const listenUrl =
      call?.monitor?.listenUrl ||
      call?.monitor?.listenURL ||
      call?.listenUrl ||
      null

    if (typeof listenUrl === "string" && listenUrl.startsWith("ws")) {
      writeBridgeLog("info", "listen-url-resolved", { attempt, via: "call.monitor.listenUrl" })
      return listenUrl
    }

    writeBridgeLog("warn", "listen-url-missing", {
      attempt,
      keys: Object.keys(call || {}),
      hasMonitor: !!call?.monitor,
    })
    await new Promise((r) => setTimeout(r, 1200))
  }

  throw new Error("Unable to resolve monitor.listenUrl from Vapi call details")
}

function parseAudioBufferFromMessage(raw) {
  if (Buffer.isBuffer(raw)) {
    const maybeJson = raw.toString("utf8")
    const trimmed = maybeJson.trim()
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
      // Some providers stream raw PCM bytes directly as websocket binary frames.
      return raw
    }
  }

  let parsed
  try {
    parsed = JSON.parse(raw.toString())
  } catch {
    writeBridgeLog("debug", "unparsed-message", {
      kind: Buffer.isBuffer(raw) ? "buffer" : typeof raw,
      size: Buffer.isBuffer(raw) ? raw.length : String(raw).length,
    })
    return null
  }

  // Handle common payload shapes from streaming audio providers.
  const base64Audio =
    parsed?.audio ||
    parsed?.audioChunk ||
    parsed?.audioData ||
    parsed?.data?.audio ||
    parsed?.data?.audioChunk ||
    parsed?.data?.audioData ||
    parsed?.chunk?.audio ||
    parsed?.chunk?.data ||
    parsed?.payload?.audio ||
    parsed?.payload?.audioData ||
    null

  if (!base64Audio || typeof base64Audio !== "string") {
    writeBridgeLog("debug", "non-audio-message", {
      type: parsed?.type || "unknown",
      keys: Object.keys(parsed || {}),
    })
    return null
  }

  return Buffer.from(base64Audio, "base64")
}

function pcm16ToWav(pcmBuffer, rate) {
  const channels = 1
  const bitsPerSample = 16
  const byteRate = (rate * channels * bitsPerSample) / 8
  const blockAlign = (channels * bitsPerSample) / 8
  const dataSize = pcmBuffer.length
  const header = Buffer.alloc(44)

  header.write("RIFF", 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write("WAVE", 8)
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write("data", 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcmBuffer])
}

async function inferWithMeralion(wavBuffer) {
  const b64 = wavBuffer.toString("base64")
  const audioDataUrl = `data:audio/wav;base64,${b64}`
  const instruction = [
    "You are a multilingual health check-in assistant for Singapore seniors.",
    `Listen to this audio turn. Language hint: ${languageHint}.`,
    "Return JSON only with keys:",
    "transcript, language, mood, meds_taken, response_text.",
    "Keep response_text short (<= 2 sentences), warm, and practical.",
  ].join("\n")

  const res = await fetch(`${meralionBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${meralionApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: meralionModel,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instruction },
            { type: "audio_url", audio_url: { url: audioDataUrl } },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`MERaLiON error ${res.status}: ${await res.text()}`)
  }

  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content || ""
  if (!content) {
    throw new Error("MERaLiON returned empty content")
  }

  if (process.env.BRIDGE_LOG_RAW === "1") {
    console.log(`${LOG_PREFIX} MERaLiON raw content:`, content)
    writeBridgeLog("info", "meralion-raw", { content })
  }

  try {
    return JSON.parse(content)
  } catch {
    // Fallback if model emits non-JSON unexpectedly.
    return {
      transcript: "",
      language: "unknown",
      mood: "neutral",
      meds_taken: null,
      response_text: String(content).slice(0, 300),
    }
  }
}

async function sayToCall(text) {
  if (!text || !text.trim()) return

  const res = await fetch(`https://api.vapi.ai/call/${callId}/control`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vapiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "say",
      text,
    }),
  })

  if (!res.ok) {
    throw new Error(`Vapi control error ${res.status}: ${await res.text()}`)
  }
}

async function flushBufferedAudio() {
  if (isFlushing) return
  if (bytesBuffered === 0) return
  isFlushing = true

  const pcm = Buffer.concat(pcmChunks)
  pcmChunks.length = 0
  bytesBuffered = 0

  const wav = pcm16ToWav(pcm, sampleRate)
  const debugOut = process.env.BRIDGE_DEBUG_WAV_PATH
  if (debugOut) {
    fs.writeFileSync(debugOut, wav)
  }

  try {
    const modelResult = await inferWithMeralion(wav)
    console.log(`${LOG_PREFIX} MERaLiON transcript:`, modelResult.transcript || "(none)")
    console.log(`${LOG_PREFIX} MERaLiON language:`, modelResult.language || "unknown")
    console.log(`${LOG_PREFIX} MERaLiON mood:`, modelResult.mood || "unknown")
    console.log(`${LOG_PREFIX} MERaLiON response_text:`, modelResult.response_text || "(none)")
    writeBridgeLog("info", "meralion-output", {
      transcript: modelResult.transcript || "",
      language: modelResult.language || "unknown",
      mood: modelResult.mood || "unknown",
      response_text: modelResult.response_text || "",
    })
    await sayToCall(modelResult.response_text || "I heard you. Thank you for sharing.")
  } catch (err) {
    console.error(`${LOG_PREFIX} inference/control failed`, err)
    writeBridgeLog("error", "inference-control-failed", {
      error: err instanceof Error ? err.message : String(err),
    })
  } finally {
    isFlushing = false
    // If new audio arrived while inferencing, process it next.
    if (bytesBuffered > 0) {
      void flushBufferedAudio()
    }
  }
}

const chunkTargetBytes = sampleRate * 2 * chunkSeconds
let lastFlushAt = Date.now()

async function main() {
  try {
    const listenUrl = await resolveListenUrl()
    const ws = new WebSocket(listenUrl, {
      headers: {
        Authorization: `Bearer ${vapiApiKey}`,
      },
    })

    ws.on("open", () => {
      console.log(`${LOG_PREFIX} connected to Vapi listen websocket for call ${callId}`)
      writeBridgeLog("info", "ws-open")
    })

    ws.on("message", async (message) => {
      const audio = parseAudioBufferFromMessage(message)
      if (!audio) return

      pcmChunks.push(audio)
      bytesBuffered += audio.length

      const enoughBytes = bytesBuffered >= chunkTargetBytes
      const enoughTime = Date.now() - lastFlushAt >= chunkSeconds * 1000
      if (enoughBytes || enoughTime) {
        lastFlushAt = Date.now()
        void flushBufferedAudio()
      }
    })

    ws.on("close", async () => {
      console.log(`${LOG_PREFIX} Vapi listen websocket closed`)
      writeBridgeLog("info", "ws-close")
      await flushBufferedAudio()
      process.exit(0)
    })

    ws.on("error", (err) => {
      console.error(`${LOG_PREFIX} websocket error`, err)
      writeBridgeLog("error", "ws-error", {
        error: err instanceof Error ? err.message : String(err),
      })
    })

    process.on("SIGINT", async () => {
      console.log(`${LOG_PREFIX} shutting down`)
      ws.close()
    })
  } catch (err) {
    console.error(`${LOG_PREFIX} startup failed`, err)
    writeBridgeLog("error", "startup-failed", {
      error: err instanceof Error ? err.message : String(err),
    })
    process.exit(1)
  }
}

void main()
