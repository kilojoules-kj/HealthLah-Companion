import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/app/lib/supabase"

// GET /api/patients - list all patients (no auth yet; filter by caregiver_id when you add auth)
export async function GET(_req: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ patients: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to fetch patients" }, { status: 500 })
  }
}

// POST /api/patients - create new patient (caregiver_id null until auth is added)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { data, error } = await supabaseAdmin
      .from("patients")
      .insert({
        ...body,
        caregiver_id: body.caregiver_id ?? null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ patient: data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to create patient" }, { status: 500 })
  }
}

