import { NextRequest, NextResponse } from "next/server"
import { getPatientById } from "@/app/lib/supabase"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "Patient ID required" }, { status: 400 })
    }
    const patient = await getPatientById(id)
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }
    return NextResponse.json({ patient })
  } catch (error: unknown) {
    console.error("Fetch patient failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch patient" },
      { status: 500 }
    )
  }
}
