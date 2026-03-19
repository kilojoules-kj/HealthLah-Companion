import { NextRequest, NextResponse } from "next/server"
import { updateCallLog, createMemory, getCallLogByVapiCallId, createCallLog } from "@/app/lib/supabase"

// VAPI webhook handler - captures call data and saves to database
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const { message } = payload

    console.log("[VAPI Webhook] Received:", message?.type, "for call:", message?.call?.id)

    if (!message) {
      return NextResponse.json({ received: true })
    }

    switch (message.type) {
      case "call-ended":
      case "end-of-call-report":
        await handleCallEnded(message)
        break
      case "call-started":
        console.log("[VAPI Webhook] Call started:", message.call?.id)
        break
      default:
        console.log("[VAPI Webhook] Unhandled type:", message.type)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("[VAPI Webhook] Error:", error)
    return NextResponse.json({ error: "Webhook error" }, { status: 500 })
  }
}

async function handleCallEnded(message: any) {
  const call = message.call
  if (!call?.id) {
    console.log("[VAPI Webhook] No call ID, skipping")
    return
  }

  const vapiCallId = call.id

  // VAPI sends transcript/summary/analysis on message, not on call
  const transcript = message.transcript || message.artifact?.transcript || ""
  const summary = message.analysis?.summary || message.summary || ""
  const duration = call.durationSeconds || 0

  console.log("[VAPI Webhook] Processing call end:", vapiCallId)
  console.log("[VAPI Webhook] Call data:", {
    duration,
    hasTranscript: !!transcript,
    hasSummary: !!summary,
    hasAnalysis: !!message.analysis,
  })

  // Try to find existing call log
  let existingLog = await getCallLogByVapiCallId(vapiCallId)

  // If no log exists, create one
  if (!existingLog) {
    console.log("[VAPI Webhook] Creating new call log")
    try {
      await createCallLog({
        patient_id: null, // Will be matched when call is registered
        vapi_call_id: vapiCallId,
        started_at: new Date(Date.now() - duration * 1000).toISOString(),
      })
      existingLog = await getCallLogByVapiCallId(vapiCallId)
    } catch (e) {
      console.error("[VAPI Webhook] Failed to create call log:", e)
      return
    }
  }

  if (!existingLog) {
    console.error("[VAPI Webhook] Could not create call log")
    return
  }

  // Try to extract mood and other structured data
  let mood = "neutral"
  let medsTaken = false
  let hasStory = false
  let storyTitle = ""
  let storyContent = ""

  // VAPI structured data lives in message.analysis.structuredData
  const structuredData = message.analysis?.structuredData
  if (structuredData) {
    if (structuredData.mood) mood = structuredData.mood
    if (structuredData.meds_taken !== undefined) medsTaken = structuredData.meds_taken
    if (structuredData.has_story !== undefined) hasStory = structuredData.has_story
    if (structuredData.chapter_title) storyTitle = structuredData.chapter_title
    if (structuredData.chapter_content) storyContent = structuredData.chapter_content
  }

  // Fallback: detect mood from transcript keywords
  if (mood === "neutral" && transcript) {
    const t = transcript.toLowerCase()
    if (t.includes("happy") || t.includes("good") || t.includes("great")) mood = "happy"
    else if (t.includes("sad") || t.includes("lonely")) mood = "sad"
    else if (t.includes("tired")) mood = "tired"
  }

  // Calculate mood score
  const moodScore = mood === "happy" ? 5 : mood === "sad" ? 2 : 3

  // Build concern flags
  const concernFlags: string[] = []
  const t = transcript.toLowerCase()
  if (t.includes("pain")) concernFlags.push("pain mentioned")
  if (t.includes("fall")) concernFlags.push("fall risk")
  if (t.includes("dizzy")) concernFlags.push("dizziness")
  if (mood === "sad") concernFlags.push("mood concern")

  // Update the call log
  const updates = {
    ended_at: new Date().toISOString(),
    duration_seconds: duration,
    transcript: transcript,
    summary: summary || `Call completed. Mood: ${mood}.`,
    mood_score: moodScore,
    medication_confirmed: medsTaken,
    concern_flags: concernFlags,
    memories_extracted: hasStory && storyContent ? [{ title: storyTitle, text: storyContent }] : [],
  }

  console.log("[VAPI Webhook] Saving updates:", updates)
  await updateCallLog(vapiCallId, updates)

  // Create memory if there's a story
  if (hasStory && storyContent && existingLog.patient_id) {
    console.log("[VAPI Webhook] Creating memory:", storyTitle)
    await createMemory({
      patient_id: existingLog.patient_id,
      call_id: vapiCallId,
      memory_text: storyContent,
      category: storyTitle || "Story",
      date_mentioned: new Date().toISOString().slice(0, 10),
      sentiment: mood,
    })
  }

  console.log("[VAPI Webhook] Call processed successfully")
}
