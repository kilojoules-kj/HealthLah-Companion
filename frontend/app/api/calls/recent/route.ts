import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/app/lib/supabase"

export async function GET(_req: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from("call_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10)

    if (error) throw error

    return NextResponse.json({ 
      calls: data || [],
      count: data?.length || 0 
    })
  } catch (e) {
    console.error("Failed to fetch calls:", e)
    return NextResponse.json({ calls: [], count: 0 }, { status: 500 })
  }
}
