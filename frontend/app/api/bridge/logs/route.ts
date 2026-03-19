import { NextRequest, NextResponse } from "next/server"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"

export const runtime = "nodejs"

function getBridgeLogDir(): string {
  return process.env.BRIDGE_LOG_DIR || path.join(os.tmpdir(), "healthlah-bridge-logs")
}

type BridgeLogEntry = {
  ts: string
  callId: string
  level: "info" | "error" | string
  event: string
  payload?: Record<string, unknown>
}

function isSafeCallId(callId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(callId)
}

export async function GET(req: NextRequest) {
  try {
    const callId = req.nextUrl.searchParams.get("callId")
    const since = Number(req.nextUrl.searchParams.get("since") || "0")

    if (!callId) {
      return NextResponse.json({ error: "callId is required" }, { status: 400 })
    }

    if (!isSafeCallId(callId)) {
      return NextResponse.json({ error: "invalid callId" }, { status: 400 })
    }

    const filePath = path.join(getBridgeLogDir(), `${callId}.jsonl`)

    let raw = ""
    try {
      raw = await fs.readFile(filePath, "utf8")
    } catch {
      return NextResponse.json({ entries: [], nextSince: since })
    }

    const lines = raw.split("\n").filter(Boolean)
    const entries = lines
      .map((line) => {
        try {
          return JSON.parse(line) as BridgeLogEntry
        } catch {
          return null
        }
      })
      .filter((x): x is BridgeLogEntry => x !== null)

    const sliced = entries.slice(since)
    return NextResponse.json({
      entries: sliced,
      nextSince: entries.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed to read logs" },
      { status: 500 }
    )
  }
}
