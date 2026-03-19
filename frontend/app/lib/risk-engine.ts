/**
 * Risk Engine — post-call emotional & health risk analysis via MERaLiON.
 *
 * After a call ends, the transcript is sent to MERaLiON with a structured
 * analysis prompt. The response is parsed into a RiskAssessment object and
 * saved to the call_logs row in Supabase.
 */

const MERALION_BASE = process.env.MERALION_BASE_URL || "http://meralion.org:8010"
const MERALION_MODEL = "MERaLiON/MERaLiON-3-100"

// ── Types ──────────────────────────────────────────────────

export interface EmotionalAnalysis {
  /** Primary emotion detected: happy, sad, anxious, angry, confused, neutral, distressed */
  primary_emotion: string
  /** Confidence 0-1 */
  confidence: number
  /** Secondary emotions present */
  secondary_emotions: string[]
  /** Overall sentiment: positive, negative, neutral, mixed */
  sentiment: string
  /** Vocal/textual cues observed */
  cues: string[]
  /** Loneliness indicator: none, mild, moderate, severe */
  loneliness_indicator: string
  /** Cognitive flags: e.g. repetition, confusion, word-finding difficulty */
  cognitive_flags: string[]
}

export interface RiskAssessment {
  /** 0-100, higher = more concern */
  risk_score: number
  /** low | moderate | high | critical */
  risk_level: "low" | "moderate" | "high" | "critical"
  /** Detailed emotional breakdown */
  emotional_analysis: EmotionalAnalysis
  /** Actionable risk factors identified */
  risk_factors: string[]
  /** Recommended follow-up actions */
  recommendations: string[]
  /** Whether caregiver should be alerted */
  alert_caregiver: boolean
  /** Reason for alert, if any */
  alert_reason?: string
}

// ── MERaLiON Analysis Prompt ───────────────────────────────

function buildAnalysisPrompt(
  transcript: string,
  patientContext: {
    name?: string
    age?: number | string
    conditions?: string[]
    medications?: string
    preferred_language?: string
  }
): string {
  const conditions = patientContext.conditions?.join(", ") || "not specified"
  const meds = patientContext.medications || "not specified"

  return `You are a clinical risk assessment AI analysing a health check-in call transcript for an elderly patient in Singapore.

PATIENT CONTEXT:
- Name: ${patientContext.name || "Unknown"}
- Age: ${patientContext.age || "Unknown"}
- Chronic conditions: ${conditions}
- Medications: ${meds}
- Preferred language: ${patientContext.preferred_language || "English"}

TRANSCRIPT:
"""
${transcript}
"""

Analyse the transcript for emotional state, health risks, and wellbeing indicators. You MUST respond with ONLY valid JSON — no markdown, no explanation, no text before or after.

{
  "primary_emotion": "<one of: happy, sad, anxious, angry, confused, neutral, distressed>",
  "confidence": <0.0 to 1.0>,
  "secondary_emotions": ["<emotion>", ...],
  "sentiment": "<positive | negative | neutral | mixed>",
  "cues": ["<observed vocal or textual cue>", ...],
  "loneliness_indicator": "<none | mild | moderate | severe>",
  "cognitive_flags": ["<flag>", ...],
  "risk_factors": ["<specific risk identified>", ...],
  "recommendations": ["<actionable follow-up>", ...],
  "alert_caregiver": <true | false>,
  "alert_reason": "<reason if alert_caregiver is true, else null>",
  "risk_score": <0-100>
}

SCORING GUIDELINES:
- 0-25: Low risk — patient sounds well, positive or neutral mood, medications taken, no concerning symptoms
- 26-50: Moderate risk — mild mood concerns, partial medication adherence, minor symptoms, mild loneliness
- 51-75: High risk — significant mood decline, medication non-adherence, concerning symptoms, social isolation
- 76-100: Critical — emergency symptoms, severe distress, cognitive decline signs, immediate intervention needed

Consider these factors for Singapore elderly patients:
- Social isolation is common and a major risk factor
- Medication non-adherence in elderly is often due to forgetfulness, not refusal
- Multilingual patients may express distress differently across languages
- Subtle changes from previous calls (if referenced) are significant
- Physical symptoms reported casually may indicate serious conditions`
}

// ── MERaLiON Call ──────────────────────────────────────────

async function callMeralion(prompt: string): Promise<string> {
  const apiKey = process.env.MERALION_API_KEY
  if (!apiKey) {
    throw new Error("MERALION_API_KEY not configured")
  }

  const response = await fetch(`${MERALION_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MERALION_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a clinical risk analysis AI. Respond with ONLY valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 1024,
      stream: false,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`MERaLiON API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? ""
}

// ── Parse Response ─────────────────────────────────────────

function riskLevelFromScore(score: number): "low" | "moderate" | "high" | "critical" {
  if (score >= 76) return "critical"
  if (score >= 51) return "high"
  if (score >= 26) return "moderate"
  return "low"
}

function parseAnalysisResponse(raw: string): RiskAssessment {
  // Strip markdown code fences if present
  let cleaned = raw.trim()
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    console.error("[RiskEngine] Failed to parse MERaLiON response:", raw.substring(0, 200))
    return fallbackAssessment("Failed to parse MERaLiON response")
  }

  const riskScore = clamp(Number(parsed.risk_score) || 0, 0, 100)

  const emotional: EmotionalAnalysis = {
    primary_emotion: String(parsed.primary_emotion || "neutral"),
    confidence: clamp(Number(parsed.confidence) || 0.5, 0, 1),
    secondary_emotions: toStringArray(parsed.secondary_emotions),
    sentiment: String(parsed.sentiment || "neutral"),
    cues: toStringArray(parsed.cues),
    loneliness_indicator: String(parsed.loneliness_indicator || "none"),
    cognitive_flags: toStringArray(parsed.cognitive_flags),
  }

  return {
    risk_score: riskScore,
    risk_level: riskLevelFromScore(riskScore),
    emotional_analysis: emotional,
    risk_factors: toStringArray(parsed.risk_factors),
    recommendations: toStringArray(parsed.recommendations),
    alert_caregiver: Boolean(parsed.alert_caregiver),
    alert_reason: parsed.alert_reason ? String(parsed.alert_reason) : undefined,
  }
}

// ── Fallback (keyword-based) ───────────────────────────────

function fallbackAssessment(reason: string): RiskAssessment {
  console.warn("[RiskEngine] Using fallback assessment:", reason)
  return {
    risk_score: 15,
    risk_level: "low",
    emotional_analysis: {
      primary_emotion: "neutral",
      confidence: 0.3,
      secondary_emotions: [],
      sentiment: "neutral",
      cues: [],
      loneliness_indicator: "none",
      cognitive_flags: [],
    },
    risk_factors: [],
    recommendations: ["Continue regular check-ins"],
    alert_caregiver: false,
  }
}

/**
 * Keyword-based fallback when MERaLiON is unreachable.
 * Scans the transcript for known concern patterns.
 */
function keywordFallbackAssessment(transcript: string): RiskAssessment {
  const t = transcript.toLowerCase()
  let score = 10
  const factors: string[] = []
  const cues: string[] = []
  const recommendations: string[] = ["Continue regular check-ins"]

  // Emergency keywords
  const emergencyKeywords = [
    "chest pain", "cannot breathe", "stroke", "fainted",
    "胸口痛", "不能呼吸", "跌倒", "நெஞ்சு வலி", "sakit dada",
  ]
  for (const kw of emergencyKeywords) {
    if (t.includes(kw)) {
      score += 40
      factors.push(`Emergency keyword: "${kw}"`)
    }
  }

  // Mood keywords
  if (t.includes("sad") || t.includes("lonely") || t.includes("alone") || t.includes("寂寞") || t.includes("sedih")) {
    score += 15
    factors.push("Negative mood expressed")
    cues.push("Sadness/loneliness mentioned")
  }
  if (t.includes("tired") || t.includes("no energy") || t.includes("累") || t.includes("penat")) {
    score += 10
    factors.push("Fatigue reported")
    cues.push("Tiredness/low energy")
  }
  if (t.includes("forgot") || t.includes("don't remember") || t.includes("忘了") || t.includes("lupa")) {
    score += 10
    factors.push("Memory concern")
    cues.push("Possible cognitive flag: forgetfulness")
  }
  if (t.includes("didn't take") || t.includes("missed") || t.includes("没吃药") || t.includes("tak makan ubat")) {
    score += 12
    factors.push("Medication non-adherence")
    recommendations.push("Follow up on medication adherence")
  }
  if (t.includes("pain") || t.includes("hurts") || t.includes("痛") || t.includes("sakit") || t.includes("வலி")) {
    score += 10
    factors.push("Pain reported")
  }
  if (t.includes("dizzy") || t.includes("头晕") || t.includes("pening") || t.includes("தலை சுத்துது")) {
    score += 10
    factors.push("Dizziness reported")
  }
  if (t.includes("can't sleep") || t.includes("insomnia") || t.includes("睡不着") || t.includes("tidak boleh tidur")) {
    score += 8
    factors.push("Sleep disturbance")
  }

  score = clamp(score, 0, 100)
  const alertCaregiver = score >= 51

  return {
    risk_score: score,
    risk_level: riskLevelFromScore(score),
    emotional_analysis: {
      primary_emotion: score >= 51 ? "distressed" : score >= 26 ? "anxious" : "neutral",
      confidence: 0.4,
      secondary_emotions: [],
      sentiment: score >= 51 ? "negative" : score >= 26 ? "mixed" : "neutral",
      cues,
      loneliness_indicator: t.includes("lonely") || t.includes("alone") || t.includes("寂寞") ? "moderate" : "none",
      cognitive_flags: t.includes("forgot") || t.includes("don't remember") ? ["forgetfulness"] : [],
    },
    risk_factors: factors,
    recommendations,
    alert_caregiver: alertCaregiver,
    alert_reason: alertCaregiver ? `Risk score ${score}: ${factors.slice(0, 2).join(", ")}` : undefined,
  }
}

// ── Public API ─────────────────────────────────────────────

/**
 * Analyse a call transcript for emotional state and health risks.
 *
 * Attempts MERaLiON first; falls back to keyword analysis if unavailable.
 */
export async function analyseCallRisk(
  transcript: string,
  patientContext: {
    name?: string
    age?: number | string
    conditions?: string[]
    medications?: string
    preferred_language?: string
  }
): Promise<RiskAssessment> {
  if (!transcript || transcript.trim().length < 10) {
    return fallbackAssessment("Transcript too short for analysis")
  }

  try {
    const prompt = buildAnalysisPrompt(transcript, patientContext)
    const raw = await callMeralion(prompt)
    return parseAnalysisResponse(raw)
  } catch (err) {
    console.error("[RiskEngine] MERaLiON analysis failed, using keyword fallback:", err)
    return keywordFallbackAssessment(transcript)
  }
}

// ── Helpers ────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String)
  return []
}
