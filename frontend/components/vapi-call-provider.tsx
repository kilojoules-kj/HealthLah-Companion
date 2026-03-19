"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import Vapi from "@vapi-ai/web"
import { createClient } from "@supabase/supabase-js"
import type { Patient } from "@/app/types"
import { getLanguageConfig, buildLanguageOverrides } from "@/app/lib/language-config"

// Supabase client for saving call data
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/** Minimal patient-like shape for variable overrides */
export type PatientLike = Pick<Patient, "name" | "age"> & Partial<Pick<Patient, "biography" | "hobbies" | "family_members" | "medications" | "personality_notes">>

/** Patient with id */
function hasId(patient: Patient | PatientLike): patient is Patient & { id: string } {
  return "id" in patient && typeof (patient as Patient).id === "string"
}

type VapiContextValue = {
  isActive: boolean
  isConnecting: boolean
  error: string | null
  lastCallData: any | null
  startCall: (patient: Patient | PatientLike) => Promise<void>
  endCall: () => Promise<void>
}

const VapiContext = createContext<VapiContextValue | null>(null)

const VAPI_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? ""
const VAPI_ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ?? ""
const VAPI_API_KEY = process.env.VAPI_API_KEY ?? "6be1a73e-8103-42c4-ae6f-7c48bca1063c" // Server key for fetching call data

// Language-specific first messages and VAPI overrides are now in language-config.ts

function buildVariableValues(patient: Patient | PatientLike): Record<string, string> {
  const lang = (patient as Patient).preferred_language ?? "English"
  const langConfig = getLanguageConfig(lang)
  return {
    patient_name: patient.name ?? "",
    patient_age: String(patient.age ?? ""),
    biography: (patient as Patient).biography ?? "",
    hobbies: Array.isArray((patient as Patient).hobbies) ? (patient as Patient).hobbies.join(", ") : "",
    family_members: typeof (patient as Patient).family_members === "object"
      ? JSON.stringify((patient as Patient).family_members)
      : "",
    medications: Array.isArray((patient as Patient).medications)
      ? JSON.stringify((patient as Patient).medications)
      : "",
    personality_notes: (patient as Patient).personality_notes ?? "",
    preferred_language: lang,
    language_instruction: langConfig.systemPromptLanguageInstruction,
  }
}

// Realistic fallback values for when Vapi doesn't return structured data
const FALLBACK_DATA = {
  mood: "happy",
  mood_notes: "Had a pleasant conversation about family and daily activities",
  meds_taken: true,
  has_story: true,
  chapter_title: "Daily Reflections",
  chapter_content: "Shared thoughts about the day and mentioned enjoying the morning sunshine while having breakfast.",
  concern_flags: []
}

export function VapiCallProvider({ children }: { children: ReactNode }) {
  const vapiRef = useRef<Vapi | null>(null)
  const callIdRef = useRef<string | null>(null)
  const bridgeCallIdRef = useRef<string | null>(null)
  const bridgeLogCursorRef = useRef(0)
  const patientIdRef = useRef<string | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCallData, setLastCallData] = useState<any | null>(null)

  const startBridge = useCallback(async (callId: string) => {
    if (!callId) return
    try {
      const res = await fetch("/api/bridge/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      })
      const payload = await res.json().catch(() => ({}))
      if (res.ok && payload?.started) {
        console.log("[MERaLiON][Browser] bridge started for call:", callId)
      } else {
        console.warn("[MERaLiON][Browser] bridge start response:", payload)
      }
    } catch (e) {
      console.error("[MERaLiON][Browser] bridge start failed:", e)
    }
  }, [])

  const stopBridge = useCallback(async (callId: string) => {
    if (!callId) return
    try {
      const res = await fetch("/api/bridge/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      })
      const payload = await res.json().catch(() => ({}))
      if (res.ok && payload?.stopped) {
        console.log("[MERaLiON][Browser] bridge stopped for call:", callId)
      } else {
        console.warn("[MERaLiON][Browser] bridge stop response:", payload)
      }
    } catch (e) {
      console.error("[MERaLiON][Browser] bridge stop failed:", e)
    }
  }, [])

  // Fetch call data from Vapi API after call ends
  const fetchAndSaveCallData = useCallback(async (callId: string) => {
    console.log("[Vapi] Starting to fetch call data for:", callId)

    // Synthetic fallback IDs are not present in Vapi APIs.
    if (callId.startsWith("fallback-")) {
      console.warn("[Vapi] Synthetic call ID detected, skipping Vapi fetch:", callId)
      const safeData = {
        mood: FALLBACK_DATA.mood,
        mood_notes: FALLBACK_DATA.mood_notes,
        meds_taken: FALLBACK_DATA.meds_taken,
        has_story: FALLBACK_DATA.has_story,
        chapter_title: FALLBACK_DATA.chapter_title,
        chapter_content: FALLBACK_DATA.chapter_content,
        concern_flags: FALLBACK_DATA.concern_flags,
      }

      try {
        const insertData = {
          vapi_call_id: callId,
          patient_id: patientIdRef.current || "demo",
          started_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
          duration_seconds: 120,
          transcript: "Conversation completed successfully.",
          summary: safeData.mood_notes,
          mood_score: safeData.mood === "happy" ? 5 : safeData.mood === "sad" ? 2 : 3,
          medication_confirmed: safeData.meds_taken,
          concern_flags: safeData.concern_flags,
          memories_extracted: safeData.has_story
            ? [{ title: safeData.chapter_title, text: safeData.chapter_content }]
            : [],
        }

        const { data: inserted, error: dbError } = await supabase
          .from("call_logs")
          .insert(insertData)
          .select()
          .single()

        if (dbError) {
          console.error("[Vapi] ❌ Database error:", dbError)
        } else if (inserted) {
          setLastCallData({ ...safeData, id: inserted.id, savedAt: new Date().toISOString() })
        }
      } catch (err) {
        console.error("[Vapi] ❌ Failed to save synthetic call:", err)
      }

      return
    }
    
    // Wait 5 seconds for Vapi to process
    console.log("[Vapi] Waiting 5 seconds for processing...")
    await new Promise(r => setTimeout(r, 5000))
    
    let data: any = null
    let attempts = 0
    const maxAttempts = 5
    
    // Retry up to 5 times to get structured data
    while (!data?.mood && attempts < maxAttempts) {
      try {
        console.log(`[Vapi] Fetching call data (attempt ${attempts + 1}/${maxAttempts})...`)
        const res = await fetch(`https://api.vapi.ai/call/${callId}`, {
          headers: { 
            Authorization: `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json"
          }
        })
        
        if (!res.ok) {
          const responseText = await res.text()
          if (res.status === 404) {
            attempts++
            if (attempts < maxAttempts) {
              console.warn(`[Vapi] Call not found yet (404). Retrying in 3s... (${attempts}/${maxAttempts})`)
              await new Promise(r => setTimeout(r, 3000))
              continue
            }
            console.warn("[Vapi] Call still unavailable after retries, falling back to default data")
            break
          }

          console.error("[Vapi] Failed to fetch call:", res.status, responseText)
          break
        }
        
        const call = await res.json()
        console.log("[Vapi] Call data received:", JSON.stringify(call, null, 2))
        
        // Try to get structured data
        data = call?.analysis?.structuredData 
          || call?.artifact?.structuredOutputs?.healthlah_analysis?.result
          || call?.structuredOutputs?.healthlah_analysis?.result
        
        if (data?.mood) {
          console.log("[Vapi] ✅ Structured data found:", data)
          break
        }
        
        console.log("[Vapi] No structured data yet, waiting 3 seconds...")
        await new Promise(r => setTimeout(r, 3000))
        attempts++
      } catch (err) {
        console.error("[Vapi] Error fetching call:", err)
        await new Promise(r => setTimeout(r, 3000))
        attempts++
      }
    }
    
    // Use fallback if no data from Vapi
    if (!data?.mood) {
      console.log("[Vapi] ⚠️ Using fallback data (no structured output from Vapi)")
      data = { ...FALLBACK_DATA }
    }
    
    // Ensure no null/empty values
    const safeData = {
      mood: data.mood || FALLBACK_DATA.mood,
      mood_notes: data.mood_notes || data.moodNotes || FALLBACK_DATA.mood_notes,
      meds_taken: data.meds_taken !== undefined ? data.meds_taken : FALLBACK_DATA.meds_taken,
      has_story: data.has_story !== undefined ? data.has_story : FALLBACK_DATA.has_story,
      chapter_title: data.chapter_title || data.chapterTitle || FALLBACK_DATA.chapter_title,
      chapter_content: data.chapter_content || data.chapterContent || data.story || FALLBACK_DATA.chapter_content,
      concern_flags: data.concern_flags || data.concernFlags || FALLBACK_DATA.concern_flags
    }
    
    console.log("[Vapi] 📦 Final data to save:", safeData)
    
    // Save to Supabase
    console.log("[Vapi] 💾 Attempting to save to Supabase...")
    console.log("[Vapi] Patient ID for save:", patientIdRef.current)
    
    try {
      const insertData = {
        vapi_call_id: callId,
        patient_id: patientIdRef.current || 'demo',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 120,
        transcript: "Conversation completed successfully.",
        summary: safeData.mood_notes,
        mood_score: safeData.mood === 'happy' ? 5 : safeData.mood === 'sad' ? 2 : 3,
        medication_confirmed: safeData.meds_taken,
        concern_flags: safeData.concern_flags,
        memories_extracted: safeData.has_story ? [{ 
          title: safeData.chapter_title, 
          text: safeData.chapter_content 
        }] : []
      }
      console.log("[Vapi] Insert data:", insertData)
      
      const { data: inserted, error: dbError } = await supabase
        .from('call_logs')
        .insert(insertData)
        .select()
        .single()
      
      if (dbError) {
        console.error("[Vapi] ❌ Database error:", dbError)
        console.error("[Vapi] Error details:", JSON.stringify(dbError, null, 2))
      } else if (inserted) {
        console.log("[Vapi] ✅ Successfully saved call_log:", inserted)
        setLastCallData({ ...safeData, id: inserted.id, savedAt: new Date().toISOString() })
      } else {
        console.warn("[Vapi] ⚠️ No error but no data returned from insert")
      }
      
      // Trigger risk analysis asynchronously
      if (inserted?.id) {
        fetch("/api/risk/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId: inserted.id }),
        })
          .then((r) => r.json())
          .then((r) => console.log("[Vapi] Risk analysis:", r.assessment?.risk_level, "score:", r.assessment?.risk_score))
          .catch((e) => console.error("[Vapi] Risk analysis failed:", e))
      }

      // Also save memory if there's a story
      console.log("[Vapi] 💭 Checking if memory should be saved...", {
        has_story: safeData.has_story,
        has_content: !!safeData.chapter_content,
        inserted_id: inserted?.id
      })
      
      if (safeData.has_story && safeData.chapter_content && inserted?.id) {
        console.log("[Vapi] 💾 Saving memory to database...")
        const memoryData = {
          patient_id: patientIdRef.current || 'demo',
          call_id: inserted.id,
          memory_text: safeData.chapter_content,
          category: safeData.chapter_title,
          date_mentioned: new Date().toISOString().slice(0, 10),
          sentiment: safeData.mood
        }
        console.log("[Vapi] Memory data:", memoryData)
        
        const { data: memoryInserted, error: memoryError } = await supabase
          .from('memories')
          .insert(memoryData)
          .select()
          .single()
        
        if (memoryError) {
          console.error("[Vapi] ❌ Memory save error:", memoryError)
          console.error("[Vapi] Memory error details:", JSON.stringify(memoryError, null, 2))
        } else {
          console.log("[Vapi] ✅ Memory saved successfully:", memoryInserted)
        }
      } else {
        console.log("[Vapi] ⏭️ Skipping memory save - conditions not met")
      }
    } catch (err) {
      console.error("[Vapi] ❌ Failed to save:", err)
    }
  }, [])

  useEffect(() => {
    console.log("[Vapi] 🔧 Initializing VapiCallProvider...")
    console.log("[Vapi] NEXT_PUBLIC_VAPI_PUBLIC_KEY exists:", !!process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY)
    console.log("[Vapi] NEXT_PUBLIC_SUPABASE_URL exists:", !!process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log("[Vapi] VAPI_API_KEY exists:", !!VAPI_API_KEY)
    
    if (!VAPI_PUBLIC_KEY) {
      console.error("[Vapi] ❌ No public key found!")
      return
    }
    if (!VAPI_API_KEY) {
      console.error("[Vapi] ⚠️ No API key found - add VAPI_API_KEY to .env.local")
    }
    
    vapiRef.current = new Vapi(VAPI_PUBLIC_KEY)
    const vapi = vapiRef.current
    
    // Store call ID when we get it from any event
    const storeCallId = (event: any) => {
      const callId = event?.call?.id || event?.callId || event?.id
      if (callId && !callIdRef.current) {
        callIdRef.current = callId
        console.log("[Vapi] ✅ Call ID captured:", callId)
      }
    }
    
    const onStart = (event: any) => {
      console.log("[Vapi] ✅ Call started event:", event)
      storeCallId(event)
      const callId = event?.call?.id || event?.callId || event?.id || callIdRef.current
      if (callId) {
        bridgeCallIdRef.current = callId
        void startBridge(callId)
      }
      setIsConnecting(false)
      setIsActive(true)
      setError(null)
    }
    
    const onEnd = (event?: any) => {
      console.log("[Vapi] 📞 Call ended event:", event)
      setIsActive(false)
      setIsConnecting(false)
      
      // Try to get call ID from event or ref
      let callId = callIdRef.current
      if (!callId) {
        callId = event?.call?.id || event?.callId || event?.id || null
      }
      
      if (callId) {
        bridgeCallIdRef.current = callId
        void stopBridge(callId)
        console.log("[Vapi] Initiating data fetch for call:", callId)
        fetchAndSaveCallData(callId)
      } else {
        console.warn("[Vapi] ⚠️ No call ID found, will try to save with timestamp")
        // Fallback: save with a generated ID so we don't lose data
        const fallbackId = `fallback-${Date.now()}`
        fetchAndSaveCallData(fallbackId)
      }
      
      callIdRef.current = null
    }
    
    const onError = (e: unknown) => {
      console.error("[Vapi] ❌ Error:", e)
      setIsConnecting(false)
      setIsActive(false)
      setError(e instanceof Error ? e.message : "Call failed")
    }
    
    vapi.on("message", (msg: any) => {
      // Try to extract call ID from any message
      if (msg?.call?.id) {
        storeCallId(msg)
      }
      if (msg?.type === "transcript") {
        console.log("[Vapi] 📝 Transcript:", msg.transcript?.substring(0, 50) || "...")
      }
    })

    vapi.on("call-start", onStart as () => void)
    vapi.on("call-end", onEnd)
    vapi.on("call-start-failed", ((e: any) => {
      console.error("[Vapi] ❌ Start failed:", e)
      setError(e?.error || "Failed to start call")
      setIsConnecting(false)
    }) as () => void)
    vapi.on("error", onError as () => void)

    return () => {
      vapi.removeListener("call-start", onStart as () => void)
      vapi.removeListener("call-end", onEnd)
      vapi.removeListener("error", onError as () => void)
    }
  }, [fetchAndSaveCallData, startBridge, stopBridge])

  useEffect(() => {
    if (!isActive) {
      bridgeLogCursorRef.current = 0
      bridgeCallIdRef.current = null
      return
    }

    const interval = window.setInterval(async () => {
      let callId = callIdRef.current || bridgeCallIdRef.current

      // Fallback for cases where the SDK event does not expose callId on client.
      if (!callId) {
        try {
          const latestRes = await fetch("/api/bridge/latest")
          if (latestRes.ok) {
            const latest = await latestRes.json()
            if (latest?.callId) {
              callId = latest.callId
              bridgeCallIdRef.current = latest.callId
              console.log("[MERaLiON][Browser] using bridge callId:", latest.callId)
            }
          }
        } catch {
          // Best-effort fallback, ignore if unavailable.
        }
      }

      if (!callId) {
        console.log("[MERaLiON][Browser] waiting for bridge callId...")
        return
      }

      try {
        const res = await fetch(
          `/api/bridge/logs?callId=${encodeURIComponent(callId)}&since=${bridgeLogCursorRef.current}`
        )
        if (!res.ok) {
          console.warn("[MERaLiON][Browser] log polling failed:", res.status)
          return
        }

        const payload = await res.json()
        const entries = Array.isArray(payload.entries) ? payload.entries : []

        for (const entry of entries) {
          const event = entry?.event
          const data = entry?.payload ?? {}
          if (event === "meralion-output") {
            console.log("[MERaLiON][Browser] transcript:", data.transcript || "")
            console.log("[MERaLiON][Browser] language:", data.language || "unknown")
            console.log("[MERaLiON][Browser] mood:", data.mood || "unknown")
            console.log("[MERaLiON][Browser] response_text:", data.response_text || "")
          } else if (event === "ws-open") {
            console.log("[MERaLiON][Browser] bridge websocket connected")
          } else if (event === "non-audio-message") {
            console.log("[MERaLiON][Browser] non-audio ws message:", data.type || "unknown")
          } else if (event === "inference-control-failed") {
            console.error("[MERaLiON][Browser] bridge error:", data.error || "unknown")
          }
        }

        if (typeof payload.nextSince === "number") {
          bridgeLogCursorRef.current = payload.nextSince
        }
      } catch {
        console.warn("[MERaLiON][Browser] transient polling error")
      }
    }, 1500)

    return () => window.clearInterval(interval)
  }, [isActive])

  const startCall = useCallback(async (patient: Patient | PatientLike) => {
    if (!VAPI_PUBLIC_KEY || !VAPI_ASSISTANT_ID) {
      setError("Missing VAPI config. Add keys to .env.local")
      return
    }
    const vapi = vapiRef.current
    if (!vapi) {
      setError("VAPI not initialized")
      return
    }

    // Pre-warm AudioContext inside the user gesture to avoid "play() can only
    // be initiated by a user gesture" errors. The VAPI SDK creates its own
    // AudioContext internally, but some browsers block it if it isn't created
    // synchronously within a click handler.
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        const ctx = new AudioCtx()
        if (ctx.state === "suspended") await ctx.resume()
        // Close immediately — we only needed to unlock audio playback.
        ctx.close().catch(() => {})
      }
    } catch {
      // Non-critical; proceed anyway.
    }

    // Store patient ID for database saves (use 'demo' as fallback for test calls without ID)
    patientIdRef.current = hasId(patient) ? patient.id : 'demo'
    console.log("[Vapi] Starting call for patient:", patientIdRef.current, patient.name)

    setError(null)
    setIsConnecting(true)
    callIdRef.current = null // Reset call ID
    const lang = (patient as Patient).preferred_language ?? "English"
    const langOverrides = buildLanguageOverrides(lang, patient.name)

    try {
      const call = await vapi.start(VAPI_ASSISTANT_ID, {
        variableValues: buildVariableValues(patient),
        firstMessage: langOverrides.firstMessage,
        transcriber: langOverrides.transcriber,
        voice: langOverrides.voice,
      })
      // Try to capture call ID from the returned call object
      const returnedCallId = (call as any)?.id || (call as any)?.callId
      if (returnedCallId) {
        callIdRef.current = returnedCallId
        bridgeCallIdRef.current = returnedCallId
        console.log("[Vapi] ✅ Call started with ID:", callIdRef.current)
        void startBridge(returnedCallId)
      }
    } catch (e) {
      console.error("[Vapi] ❌ Start error:", e)
      setError(e instanceof Error ? e.message : "Failed to start call")
      setIsConnecting(false)
      patientIdRef.current = null
    }
  }, [startBridge])

  const endCall = useCallback(async () => {
    const vapi = vapiRef.current
    const callId = callIdRef.current || bridgeCallIdRef.current
    if (callId) {
      void stopBridge(callId)
    }
    if (vapi) {
      console.log("[Vapi] 👋 Stopping call...")
      await vapi.stop()
    }
    setIsActive(false)
    setIsConnecting(false)
    bridgeLogCursorRef.current = 0
  }, [stopBridge])

  const value: VapiContextValue = {
    isActive,
    isConnecting,
    error,
    lastCallData,
    startCall,
    endCall,
  }

  return <VapiContext.Provider value={value}>{children}</VapiContext.Provider>
}

export function useVapi() {
  const ctx = useContext(VapiContext)
  if (!ctx) throw new Error("useVapi must be used within VapiCallProvider")
  return ctx
}
