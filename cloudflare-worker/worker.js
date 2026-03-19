/**
 * Cloudflare Worker: MERaLiON Bridge for Vapi
 *
 * Endpoints:
 * - /stt (WebSocket): Vapi custom-transcriber bridge
 * - /v1/* and others (HTTP): OpenAI-compatible LLM proxy
 *
 * Deploy:
 *   wrangler deploy
 *   wrangler secret put MERALION_API_KEY
 *
 * Vapi custom transcriber:
 *   provider: custom-transcriber
 *   server.url: wss://<worker>.workers.dev/stt
 */

const MERALION_BASE = "http://meralion.org:8010";
const MERALION_MODEL = "MERaLiON/MERaLiON-3-100";
const DEFAULT_ASR_MODEL = "MERaLiON/MERaLiON-2-10B-ASR";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }

    const url = new URL(request.url);

    if (url.pathname === "/stt") {
      return handleSttWebSocket(request, env);
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return corsResponse(JSON.stringify({
        status: "ok",
        llm_model: MERALION_MODEL,
        asr_model: env.MERALION_ASR_MODEL || DEFAULT_ASR_MODEL,
      }), 200, "application/json");
    }

    return handleLlmProxy(request, env, url);
  },
};

async function handleSttWebSocket(request, env) {
  const upgradeHeader = request.headers.get("Upgrade") || "";
  if (upgradeHeader.toLowerCase() !== "websocket") {
    return corsResponse(JSON.stringify({ error: "Expected websocket upgrade" }), 426, "application/json");
  }

  const pair = new WebSocketPair();
  const clientSocket = pair[0];
  const serverSocket = pair[1];
  serverSocket.accept();

  const state = {
    audioBuffers: [],
    lastVoiceAt: Date.now(),
    lastTranscript: "",
    lastSentPartial: "",
    closed: false,
    chunkMs: Number(env.STT_CHUNK_MS || 1000),
    finalSilenceMs: Number(env.STT_FINAL_SILENCE_MS || 900),
    sampleRate: Number(env.STT_SAMPLE_RATE || 16000),
    silenceRmsThreshold: Number(env.STT_SILENCE_RMS_THRESHOLD || 150),
  };

  const flushInterval = setInterval(async () => {
    if (state.closed) return;
    if (state.audioBuffers.length === 0) return;

    const pcmChunk = concatBuffers(state.audioBuffers);
    state.audioBuffers.length = 0;

    try {
      const transcript = await transcribeWithMeralion(pcmChunk, env, state.sampleRate);
      const normalized = normalizeTranscript(transcript);

      if (normalized && normalized !== state.lastSentPartial) {
        state.lastTranscript = normalized;
        state.lastSentPartial = normalized;
        safeSend(serverSocket, {
          transcript: normalized,
          isFinal: false,
        });
      }

      const silentForMs = Date.now() - state.lastVoiceAt;
      if (state.lastTranscript && silentForMs >= state.finalSilenceMs) {
        safeSend(serverSocket, {
          transcript: state.lastTranscript,
          isFinal: true,
        });
        state.lastTranscript = "";
        state.lastSentPartial = "";
      }
    } catch (err) {
      console.error("[STT] flush error:", err?.message || String(err));
    }
  }, state.chunkMs);

  serverSocket.addEventListener("message", async (event) => {
    if (state.closed) return;

    const maybeBinary = event.data;

    if (typeof maybeBinary === "string") {
      // Handle optional text control messages from providers without crashing.
      try {
        const msg = JSON.parse(maybeBinary);
        if (msg?.type === "stop" && state.lastTranscript) {
          safeSend(serverSocket, { transcript: state.lastTranscript, isFinal: true });
          state.lastTranscript = "";
          state.lastSentPartial = "";
        }
      } catch {
        // Ignore non-JSON text frames.
      }
      return;
    }

    const audio = await toUint8Array(maybeBinary);
    if (!audio || audio.byteLength === 0) return;

    const rms = estimatePcm16Rms(audio);
    if (rms > state.silenceRmsThreshold) {
      state.lastVoiceAt = Date.now();
    }

    state.audioBuffers.push(audio);
  });

  const closeHandler = () => {
    state.closed = true;
    clearInterval(flushInterval);
    if (state.lastTranscript) {
      safeSend(serverSocket, { transcript: state.lastTranscript, isFinal: true });
    }
    try {
      serverSocket.close(1000, "stt bridge closed");
    } catch {
      // no-op
    }
  };

  serverSocket.addEventListener("close", closeHandler);
  serverSocket.addEventListener("error", (err) => {
    console.error("[STT] websocket error:", err);
    closeHandler();
  });

  return new Response(null, { status: 101, webSocket: clientSocket });
}

async function transcribeWithMeralion(pcmBytes, env, sampleRate) {
  const asrPath = env.MERALION_ASR_PATH || "/audio/transcription";
  const asrModel = env.MERALION_ASR_MODEL || DEFAULT_ASR_MODEL;
  const wavBytes = pcm16ToWav(pcmBytes, sampleRate);
  const form = new FormData();
  form.append("model", asrModel);
  form.append("file", new Blob([wavBytes], { type: "audio/wav" }), "chunk.wav");

  const headers = new Headers();
  if (env.MERALION_API_KEY) {
    headers.set("Authorization", `Bearer ${env.MERALION_API_KEY}`);
  }

  const res = await fetch(`${MERALION_BASE}${asrPath}`, {
    method: "POST",
    headers,
    body: form,
  });

  if (!res.ok) {
    throw new Error(`ASR failed: ${res.status} ${await res.text()}`);
  }

  const body = await res.json();
  return body?.text || body?.transcript || body?.result || "";
}

async function handleLlmProxy(request, env, url) {
  const targetUrl = `${MERALION_BASE}${url.pathname}${url.search}`;

  try {
    let requestBody;
    let isStreaming = false;

    if (request.method === "POST") {
      const rawBody = await request.text();

      if (url.pathname.includes("/chat/completions")) {
        let body;
        try {
          body = JSON.parse(rawBody);
        } catch {
          return corsResponse(
            JSON.stringify({ error: "Invalid JSON body" }),
            400,
            "application/json"
          );
        }

        body.model = MERALION_MODEL;
        body.stream = true;
        isStreaming = true;

        requestBody = JSON.stringify(body);
        console.log(`[MERaLiON Proxy] chat/completions -> model=${body.model}, messages=${body.messages?.length}, stream=${body.stream}`);
      } else {
        requestBody = rawBody;
      }
    }

    const forwardHeaders = new Headers();
    forwardHeaders.set("Content-Type", "application/json");
    forwardHeaders.set("Accept", "text/event-stream, application/json");

    const meralionKey = env.MERALION_API_KEY;
    if (!meralionKey) {
      console.error("[MERaLiON Proxy] MERALION_API_KEY secret is not set");
      return corsResponse(
        JSON.stringify({ error: "Proxy misconfigured: missing API key" }),
        500,
        "application/json"
      );
    }
    forwardHeaders.set("Authorization", `Bearer ${meralionKey}`);

    const meralionResponse = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: requestBody,
    });

    if (!meralionResponse.ok && !isStreaming) {
      const errText = await meralionResponse.text();
      console.error(`[MERaLiON Proxy] Upstream error ${meralionResponse.status}: ${errText}`);
      return corsResponse(errText, meralionResponse.status, "application/json");
    }

    const responseHeaders = new Headers();
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    const contentType = meralionResponse.headers.get("content-type") || "text/event-stream";
    responseHeaders.set("Content-Type", contentType);

    const transferEncoding = meralionResponse.headers.get("transfer-encoding");
    if (transferEncoding) {
      responseHeaders.set("Transfer-Encoding", transferEncoding);
    }

    return new Response(meralionResponse.body, {
      status: meralionResponse.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return corsResponse(
      JSON.stringify({ error: "Failed to reach MERaLiON", detail: err?.message || String(err) }),
      502,
      "application/json"
    );
  }
}

function normalizeTranscript(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

async function toUint8Array(data) {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (data instanceof Uint8Array) {
    return data;
  }
  // Cloudflare WS can produce a Blob in some cases.
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return new Uint8Array(await data.arrayBuffer());
  }
  return null;
}

function concatBuffers(chunks) {
  const total = chunks.reduce((sum, item) => sum + item.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function estimatePcm16Rms(buffer) {
  if (!buffer || buffer.byteLength < 2) return 0;
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const sampleCount = Math.floor(buffer.byteLength / 2);
  if (sampleCount === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < sampleCount; i += 1) {
    const s = view.getInt16(i * 2, true);
    sumSquares += s * s;
  }
  return Math.sqrt(sumSquares / sampleCount);
}

function pcm16ToWav(pcmBytes, sampleRate) {
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBytes.byteLength;
  const wav = new Uint8Array(44 + dataSize);
  const view = new DataView(wav.buffer);

  writeAscii(wav, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(wav, 8, "WAVE");
  writeAscii(wav, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(wav, 36, "data");
  view.setUint32(40, dataSize, true);
  wav.set(pcmBytes, 44);
  return wav;
}

function writeAscii(out, offset, value) {
  for (let i = 0; i < value.length; i += 1) {
    out[offset + i] = value.charCodeAt(i);
  }
}

function safeSend(socket, payload) {
  try {
    socket.send(JSON.stringify(payload));
  } catch {
    // Socket is likely already closing.
  }
}

function corsResponse(body, status = 200, contentType = "application/json") {
  return new Response(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": contentType,
    },
  });
}
