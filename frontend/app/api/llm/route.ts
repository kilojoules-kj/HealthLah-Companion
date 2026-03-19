/**
 * Next.js API Route: VAPI → MERaLiON proxy
 *
 * Alternative to the Cloudflare Worker. If your Next.js app is deployed
 * on Vercel (HTTPS), point VAPI Custom LLM URL here:
 *   https://<your-app>.vercel.app/api/llm
 *
 * This proxies VAPI's OpenAI-format chat completions to MERaLiON,
 * fixing the model name and injecting the MERaLiON API key.
 *
 * Env vars required:
 *   MERALION_API_KEY  — your MERaLiON bearer token
 *   MERALION_BASE_URL — defaults to http://meralion.org:8010
 */

import { NextRequest } from "next/server"

const MERALION_BASE = process.env.MERALION_BASE_URL || "http://meralion.org:8010"
const MERALION_MODEL = "MERaLiON/MERaLiON-3-100"

export const runtime = "edge"
export const maxDuration = 60

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET() {
  return new Response(
    JSON.stringify({ status: "ok", model: MERALION_MODEL }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  )
}

export async function POST(req: NextRequest) {
  const meralionKey = process.env.MERALION_API_KEY
  if (!meralionKey) {
    return new Response(
      JSON.stringify({ error: "MERALION_API_KEY is not configured" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    )
  }

  // Override model and force streaming for real-time VAPI voice
  body.model = MERALION_MODEL
  body.stream = true

  console.log(`[MERaLiON Proxy] messages=${(body.messages as unknown[])?.length}, model=${body.model}`)

  const meralionRes = await fetch(`${MERALION_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${meralionKey}`,
      "Accept": "text/event-stream",
    },
    body: JSON.stringify(body),
  })

  if (!meralionRes.ok) {
    const errText = await meralionRes.text()
    console.error(`[MERaLiON Proxy] Upstream ${meralionRes.status}: ${errText}`)
    return new Response(errText, {
      status: meralionRes.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }

  // Stream SSE tokens back to VAPI
  return new Response(meralionRes.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  })
}
