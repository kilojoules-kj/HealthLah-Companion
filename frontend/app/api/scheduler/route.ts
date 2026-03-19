import { NextRequest, NextResponse } from "next/server"
import { getAllPatients, createCallLog } from "@/app/lib/supabase"
import { initiateCall } from "@/app/lib/vapi"
import type { CallSchedule } from "@/app/types"

const SGT_TIMEZONE = "Asia/Singapore"

/** Returns the current time in SGT as "HH:mm" (24-hour, zero-padded). */
function currentSGTTime(): string {
  const now = new Date()
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: SGT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now)
}

/** Returns the current day name in SGT, e.g. "Monday". */
function currentSGTDay(): string {
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: SGT_TIMEZONE,
    weekday: "long",
  }).format(new Date())
}

/**
 * Returns true if the patient is scheduled to be called right now (within the
 * current minute in SGT).
 *
 * call_schedule.times  – array of "HH:mm" strings in the patient's timezone
 *                        (defaulting to SGT / Asia/Singapore).
 * call_schedule.days   – optional array of weekday names; if absent, every day.
 * call_schedule.timezone – IANA timezone string; defaults to "Asia/Singapore".
 */
function isDueNow(schedule: CallSchedule | null | undefined): boolean {
  if (!schedule?.times?.length) return false

  const tz = schedule.timezone ?? SGT_TIMEZONE
  const now = new Date()

  // Current HH:mm in the patient's designated timezone
  const currentTime = new Intl.DateTimeFormat("en-SG", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now)

  // Current weekday name in the patient's timezone
  const currentDay = new Intl.DateTimeFormat("en-SG", {
    timeZone: tz,
    weekday: "long",
  }).format(now)

  const timeMatch = schedule.times.includes(currentTime)
  const dayMatch = !schedule.days?.length || schedule.days.includes(currentDay)
  return timeMatch && dayMatch
}

/**
 * GET /api/scheduler
 *
 * Called by Vercel Cron every minute.  Vercel attaches the Authorization header
 * with the value "Bearer <CRON_SECRET>" automatically; we validate it here.
 */
export async function GET(req: NextRequest) {
  // Validate cron secret so the endpoint cannot be triggered by arbitrary callers.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const sgtTime = currentSGTTime()
  const sgtDay = currentSGTDay()
  const results: { patientId: string; name: string; callId?: string; error?: string }[] = []

  try {
    const patients = await getAllPatients()

    await Promise.allSettled(
      patients.map(async (patient) => {
        if (!isDueNow(patient.call_schedule)) return

        try {
          const { callId } = await initiateCall(patient)
          await createCallLog({
            patient_id: patient.id,
            vapi_call_id: callId,
            started_at: new Date().toISOString(),
          })
          results.push({ patientId: patient.id, name: patient.name, callId })
          console.log(`[scheduler] Initiated call to ${patient.name} (${patient.id}) — callId: ${callId}`)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          results.push({ patientId: patient.id, name: patient.name, error: message })
          console.error(`[scheduler] Failed to call ${patient.name} (${patient.id}):`, message)
        }
      })
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[scheduler] Could not fetch patients:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({
    checkedAt: { sgtTime, sgtDay },
    callsInitiated: results.filter((r) => r.callId).length,
    results,
  })
}
