import { NextRequest, NextResponse } from "next/server"
import { analyseCallRisk } from "@/app/lib/risk-engine"
import { supabaseAdmin } from "@/app/lib/supabase"

export const runtime = "nodejs"
export const maxDuration = 30

/**
 * POST /api/risk/analyze
 *
 * Runs MERaLiON emotional & risk analysis on a call transcript and
 * saves the results to the call_logs row in Supabase.
 *
 * Body: { callId: string }   — the Supabase call_log id (or vapi_call_id)
 *   OR: { transcript: string, patientContext?: {...} }  — direct analysis
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { callId, transcript: directTranscript, patientContext: directContext } = body

    let transcript: string
    let patientContext: Record<string, unknown> = {}
    let vapiCallId: string | null = null

    if (callId) {
      // Fetch call and patient data from Supabase
      const { data: callLog, error: callErr } = await supabaseAdmin
        .from("call_logs")
        .select("*")
        .or(`id.eq.${callId},vapi_call_id.eq.${callId}`)
        .maybeSingle()

      if (callErr || !callLog) {
        return NextResponse.json(
          { error: callErr?.message || "Call not found" },
          { status: 404 }
        )
      }

      transcript = callLog.transcript || ""
      vapiCallId = callLog.vapi_call_id

      // Fetch patient context if available
      if (callLog.patient_id) {
        const { data: patient } = await supabaseAdmin
          .from("patients")
          .select("name, age, conditions, medications, preferred_language")
          .eq("id", callLog.patient_id)
          .maybeSingle()

        if (patient) {
          patientContext = {
            name: patient.name,
            age: patient.age,
            conditions: patient.conditions,
            medications: typeof patient.medications === "string"
              ? patient.medications
              : JSON.stringify(patient.medications),
            preferred_language: patient.preferred_language,
          }
        }
      }
    } else if (directTranscript) {
      transcript = directTranscript
      patientContext = directContext || {}
    } else {
      return NextResponse.json(
        { error: "Provide either callId or transcript" },
        { status: 400 }
      )
    }

    if (!transcript || transcript.trim().length < 10) {
      return NextResponse.json(
        { error: "Transcript too short for analysis" },
        { status: 400 }
      )
    }

    // Run risk analysis
    console.log("[RiskAPI] Analysing call:", callId || "(direct)")
    const assessment = await analyseCallRisk(transcript, patientContext as any)
    console.log("[RiskAPI] Assessment:", assessment.risk_level, "score:", assessment.risk_score)

    // Save to Supabase if we have a call reference
    if (callId && vapiCallId) {
      const { error: updateErr } = await supabaseAdmin
        .from("call_logs")
        .update({
          risk_level: assessment.risk_level,
          risk_score: assessment.risk_score,
          emotional_analysis: assessment.emotional_analysis,
          // Also update mood_score based on the analysis for consistency
          mood_score: emotionToMoodScore(assessment.emotional_analysis.primary_emotion),
          // Merge risk factors into concern_flags
          concern_flags: assessment.risk_factors,
        })
        .eq("vapi_call_id", vapiCallId)

      if (updateErr) {
        console.error("[RiskAPI] Failed to save assessment:", updateErr)
      } else {
        console.log("[RiskAPI] Assessment saved to Supabase")
      }
    }

    return NextResponse.json({ assessment })
  } catch (error) {
    console.error("[RiskAPI] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    )
  }
}

function emotionToMoodScore(emotion: string): number {
  const map: Record<string, number> = {
    happy: 5,
    neutral: 3,
    sad: 2,
    anxious: 2,
    confused: 2,
    distressed: 1,
    angry: 2,
  }
  return map[emotion] ?? 3
}
