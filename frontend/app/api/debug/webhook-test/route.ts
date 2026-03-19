import { NextRequest, NextResponse } from "next/server"
import { getRecentCallLogs } from "@/app/lib/supabase"

export async function POST(_req: NextRequest) {
  console.log("[Debug] Webhook test endpoint hit")
  return NextResponse.json({ 
    received: true, 
    timestamp: new Date().toISOString(),
    message: "Your server is reachable!"
  })
}

export async function GET(_req: NextRequest) {
  try {
    const calls = await getRecentCallLogs(5)
    return NextResponse.json({
      status: "ok",
      recentCalls: calls,
      message: `Found ${calls.length} recent calls`
    })
  } catch (e) {
    return NextResponse.json({
      status: "error",
      message: "Failed to fetch calls"
    }, { status: 500 })
  }
}
