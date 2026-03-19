import { NextRequest, NextResponse } from "next/server"
import { getRecentCallLogs } from "@/app/lib/supabase"

/**
 * Get webhook status and recent call logs for debugging
 */
export async function GET(_req: NextRequest) {
  try {
    // Get recent call logs to check if webhooks are working
    const recentLogs = await getRecentCallLogs(5)
    
    return NextResponse.json({
      status: "ok",
      message: "Webhook endpoint is active",
      recentCalls: recentLogs.map((log: any) => ({
        id: log.id,
        vapi_call_id: log.vapi_call_id,
        patient_id: log.patient_id,
        started_at: log.started_at,
        ended_at: log.ended_at,
        has_transcript: !!log.transcript,
        has_summary: !!log.summary,
        duration: log.duration_seconds,
      })),
      tips: [
        "If recentCalls is empty, webhooks may not be reaching your server",
        "Check that ngrok is running and the URL is set in VAPI Dashboard > Organization Settings",
        "Make a test call and watch your terminal for [VAPI Webhook] logs",
      ]
    })
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}
