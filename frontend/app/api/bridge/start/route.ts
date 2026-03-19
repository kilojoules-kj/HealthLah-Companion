import { NextRequest, NextResponse } from "next/server"
import { startAudioBridgeForCall } from "@/app/lib/audio-bridge"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const callId = body?.callId as string | undefined

    if (!callId) {
      return NextResponse.json({ error: "callId is required" }, { status: 400 })
    }

    const result = startAudioBridgeForCall(callId)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed to start bridge" },
      { status: 500 }
    )
  }
}
