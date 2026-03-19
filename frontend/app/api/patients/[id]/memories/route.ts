import { NextRequest, NextResponse } from "next/server"
import { getMemoriesByPatientId } from "@/app/lib/supabase"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "Patient ID required" }, { status: 400 })
    }
    const memories = await getMemoriesByPatientId(id)
    return NextResponse.json({ memories })
  } catch (error: unknown) {
    console.error("Fetch memories failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch memories" },
      { status: 500 }
    )
  }
}
