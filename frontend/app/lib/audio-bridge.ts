import { spawn } from "node:child_process"
import path from "node:path"
import fs from "node:fs"

type BridgeStartResult =
  | { started: true; pid: number }
  | { started: false; reason: string }

declare global {
  // eslint-disable-next-line no-var
  var __healthlahBridgePids: Map<string, number> | undefined
}

function getBridgeMap(): Map<string, number> {
  if (!globalThis.__healthlahBridgePids) {
    globalThis.__healthlahBridgePids = new Map<string, number>()
  }
  return globalThis.__healthlahBridgePids
}

export function startAudioBridgeForCall(callId: string): BridgeStartResult {
  if (!callId) return { started: false, reason: "missing call id" }

  const existingPid = getBridgeMap().get(callId)
  if (existingPid) {
    return { started: false, reason: `bridge already running (pid=${existingPid})` }
  }

  if (!process.env.VAPI_LISTEN_WS_URL_TEMPLATE) {
    return { started: false, reason: "missing VAPI_LISTEN_WS_URL_TEMPLATE" }
  }

  const scriptPath = path.join(process.cwd(), "scripts", "vapi-audio-bridge.mjs")
  if (!fs.existsSync(scriptPath)) {
    return { started: false, reason: `bridge script not found at ${scriptPath}` }
  }

  const child = spawn(process.execPath, [scriptPath, `--call-id=${callId}`], {
    cwd: process.cwd(),
    env: process.env,
    detached: false,
    stdio: "inherit",
  })

  if (!child.pid) {
    return { started: false, reason: "failed to spawn bridge process" }
  }

  getBridgeMap().set(callId, child.pid)
  return { started: true, pid: child.pid }
}

export function stopAudioBridgeForCall(callId: string): { stopped: boolean; reason?: string } {
  if (!callId) return { stopped: false, reason: "missing call id" }

  const bridgeMap = getBridgeMap()
  const pid = bridgeMap.get(callId)
  if (!pid) {
    return { stopped: false, reason: "no bridge pid tracked for call" }
  }

  try {
    process.kill(pid)
    bridgeMap.delete(callId)
    return { stopped: true }
  } catch (error) {
    bridgeMap.delete(callId)
    return {
      stopped: false,
      reason: error instanceof Error ? error.message : "failed to stop bridge process",
    }
  }
}
