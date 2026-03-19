"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { PatientDashboardView } from "@/components/patient-dashboard-view"
import type { Patient, CallLog, Memory } from "@/app/types"
import { Loader2, User, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

function loadDashboard(
  setPatient: (e: Patient | null) => void,
  setCalls: (c: CallLog[]) => void,
  setMemories: (m: Memory[]) => void,
  setLoading: (l: boolean) => void
) {
  setLoading(true)
  fetch("/api/patients")
    .then((r) => r.json())
    .then((data) => {
      const list = Array.isArray(data.patients) ? data.patients : []
      const singlePatient = list.length > 0 ? list[0] : null
      if (!singlePatient) {
        setPatient(null)
        setCalls([])
        setMemories([])
        return
      }
      return Promise.all([
        fetch(`/api/patients/${singlePatient.id}/calls`).then((r) => r.json()),
        fetch(`/api/patients/${singlePatient.id}/memories`).then((r) => r.json()),
      ]).then(([callsRes, memoriesRes]) => {
        setPatient(singlePatient)
        setCalls(callsRes.calls ?? [])
        setMemories(memoriesRes.memories ?? [])
      })
    })
    .catch(console.error)
    .finally(() => setLoading(false))
}

function DashboardContent() {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [calls, setCalls] = useState<CallLog[]>([])
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard(setPatient, setCalls, setMemories, setLoading)
  }, [])

  const onRefresh = () => {
    if (patient) {
      Promise.all([
        fetch(`/api/patients/${patient.id}/calls`).then((r) => r.json()),
        fetch(`/api/patients/${patient.id}/memories`).then((r) => r.json()),
      ]).then(([callsRes, memoriesRes]) => {
        setCalls(callsRes.calls ?? [])
        setMemories(memoriesRes.memories ?? [])
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="paper-card p-8 max-w-md w-full text-center">
          <User className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold text-foreground font-heading mb-1">No patient registered yet</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Register a patient to see their health dashboard here.
          </p>
          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href="/register-patient">
              <Plus className="w-4 h-4 mr-2" />
              Register Patient
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <PatientDashboardView
      patient={patient}
      calls={calls}
      memories={memories}
      onRefresh={onRefresh}
    />
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}
