import { NextRequest, NextResponse } from "next/server"
import { getPatientById, createCallLog } from "@/app/lib/supabase"
import { initiateCall } from "@/app/lib/vapi"

export async function POST(req: NextRequest) {
  try {
    const { patientId } = await req.json()

    if (!patientId) {
      return NextResponse.json({ error: "Patient ID is required" }, { status: 400 })
    }

    const patient = await getPatientById(patientId)
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    const { callId } = await initiateCall(patient)

    await createCallLog({
      patient_id: patientId,
      vapi_call_id: callId,
      started_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      callId,
      message: `Call initiated to ${patient.name}`,
    })
  } catch (error: any) {
    console.error("Call initiation failed:", error)
    return NextResponse.json(
      { error: error?.message ?? "Failed to initiate call" },
      { status: 500 },
    )
  }
}

