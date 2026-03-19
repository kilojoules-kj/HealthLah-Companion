import { NextRequest, NextResponse } from "next/server"
import { getCallLogsByPatientId } from "@/app/lib/supabase"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "Patient ID required" }, { status: 400 })
    }
    const calls = await getCallLogsByPatientId(id)
    return NextResponse.json({ calls })
  } catch (error: unknown) {
    console.error("Fetch calls failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch calls" },
      { status: 500 }
    )
  }
}
