"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Phone, Plus, User, Loader2 } from "lucide-react"
import { useVapi } from "@/components/vapi-call-provider"
import { OutboundCallDialog } from "@/components/outbound-call-dialog"
import type { Patient } from "@/app/types"

interface PatientsListProps {
  onAddPatient: () => void
  onSelectPatient?: (patient: Patient) => void
}

export function PatientsList({ onAddPatient, onSelectPatient }: PatientsListProps) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [outboundError, setOutboundError] = useState<string | null>(null)
  const { startCall, endCall, isActive, isConnecting, error } = useVapi()

  useEffect(() => {
    fetch("/api/patients")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.patients)) setPatients(data.patients)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleStartCall = async (patient: Patient) => {
    await startCall(patient)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
              <span className="text-lg">🧚</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">HealthLah</h1>
              <p className="text-sm text-muted-foreground">Care companion dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <OutboundCallDialog
              patients={patients}
              onError={setOutboundError}
              onSuccess={() => setOutboundError(null)}
              triggerLabel="Call a number"
            />
            <Button onClick={onAddPatient} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              Add patiently
            </Button>
          </div>
        </header>

        {(error || outboundError) && (
          <div className="mb-4 p-3 rounded-[28px] bg-secondary border border-border text-destructive text-sm">
            {error ?? outboundError}
          </div>
        )}

        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Your patiently
          </h2>
          {patients.length === 0 ? (
            <div className="paper-card p-8 text-center">
              <User className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-heading text-foreground font-medium mb-1">No patiently yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Register a patient to start daily health check-in calls.
              </p>
              <Button onClick={onAddPatient} variant="outline" className="border-border">
                <Plus className="w-4 h-4 mr-2" />
                Add patiently
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {patients.map((patient) => (
                <li
                  key={patient.id}
                  className="paper-card p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-lg font-semibold text-foreground shrink-0 font-heading">
                      {patient.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{patient.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {patient.age} years · {patient.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {onSelectPatient && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectPatient(patient)}
                      >
                        View
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={() => handleStartCall(patient)}
                      disabled={isConnecting || isActive}
                    >
                      {isConnecting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Phone className="w-4 h-4 mr-1.5" />
                          {isActive ? "On call…" : "Start call"}
                        </>
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {isActive && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <Button
              onClick={endCall}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg rounded-[28px]"
            >
              End call
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
