import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import path from "node:path"

export const runtime = "nodejs"

export async function GET() {
  try {
    const dirPath = path.join(process.cwd(), "data", "bridge-logs")
    let files: string[] = []

    try {
      files = await fs.readdir(dirPath)
    } catch {
      return NextResponse.json({ callId: null })
    }

    const candidates = files.filter((f) => f.endsWith(".jsonl"))
    if (candidates.length === 0) {
      return NextResponse.json({ callId: null })
    }

    let newestFile: string | null = null
    let newestMtime = 0

    for (const file of candidates) {
      const fullPath = path.join(dirPath, file)
      const stat = await fs.stat(fullPath)
      const mtime = stat.mtimeMs
      if (mtime > newestMtime) {
        newestMtime = mtime
        newestFile = file
      }
    }

    if (!newestFile) {
      return NextResponse.json({ callId: null })
    }

    return NextResponse.json({ callId: newestFile.replace(/\.jsonl$/, "") })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed to resolve latest bridge call" },
      { status: 500 }
    )
  }
}
