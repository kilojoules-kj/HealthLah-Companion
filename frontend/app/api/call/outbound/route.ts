import { NextRequest, NextResponse } from "next/server"
import { getPatientById, createCallLog } from "@/app/lib/supabase"
import { initiateOutboundCall } from "@/app/lib/vapi"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phoneNumber, name, patientId } = body as {
      phoneNumber?: string
      name?: string
      patientId?: string
    }

    const normalized = (phoneNumber ?? "").trim().replace(/\s/g, "")
    if (!normalized) {
      return NextResponse.json(
        { error: "phoneNumber is required (e.g. +15551234567)" },
        { status: 400 }
      )
    }

    let variableValues: Record<string, string> | undefined
    let logPatientId: string | undefined

    if (patientId) {
      const patient = await getPatientById(patientId)
      if (patient) {
        logPatientId = patientId
        variableValues = {
          patient_name: patient.name,
          patient_age: String(patient.age ?? ""),
          biography: patient.biography ?? "",
          hobbies: Array.isArray(patient.hobbies) ? patient.hobbies.join(", ") : "",
          family_members: typeof patient.family_members === "object" ? JSON.stringify(patient.family_members) : "{}",
          medications: Array.isArray(patient.medications) ? JSON.stringify(patient.medications) : "[]",
          personality_notes: patient.personality_notes ?? "",
        }
      }
    }

    const { callId } = await initiateOutboundCall(normalized, {
      name: name?.trim() || undefined,
      variableValues,
    })

    if (logPatientId) {
      await createCallLog({
        patient_id: logPatientId,
        vapi_call_id: callId,
        started_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      callId,
      message: `Outbound call initiated to ${normalized}`,
    })
  } catch (error: unknown) {
    console.error("Outbound call failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initiate outbound call" },
      { status: 500 }
    )
  }
}
