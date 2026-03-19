"use client"

import { useRouter } from "next/navigation"
import { RegistrationFlow } from "@/components/registration-flow"
import type { PatientFormData, CaregiverData } from "@/app/types"

function calculateAgeFromDOB(dob: string): number {
  if (!dob) return 0
  const birthDate = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--
  return age
}

export default function RegisterPatientPage() {
  const router = useRouter()

  const handleComplete = async (patient: PatientFormData, caregiver: CaregiverData) => {
    try {
      const payload = {
        name: `${patient.firstName} ${patient.lastName}`.trim(),
        age: calculateAgeFromDOB(patient.dateOfBirth),
        phone: patient.phone,
        biography: patient.location
          ? `Lives in ${patient.location}. ${patient.thingsTheyLove || ""}`.trim()
          : patient.thingsTheyLove || "",
        hobbies: patient.thingsTheyLove
          ? patient.thingsTheyLove.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        family_members: {
          caregiver: {
            name: `${caregiver.firstName} ${caregiver.lastName}`.trim(),
            email: caregiver.email,
            phone: caregiver.phone,
            relationship: patient.relationship,
          },
        },
        medications: (patient.medicationSchedule || []).map((med) => ({
          name: med.name,
          time: med.time,
          dosage: "",
        })),
        call_schedule: {
          times: [...new Set((patient.medicationSchedule || []).map((m) => m.time).filter(Boolean))],
          timezone: "Asia/Singapore",
        },
        personality_notes: patient.thingsTheyLove || "",
        risk_flags: [],
        preferred_language: patient.preferredLanguage || "English",
        conditions: patient.conditions || [],
        emergency_contact: {
          name: patient.emergencyContactName || "",
          phone: patient.emergencyContactPhone || "",
          relationship: patient.emergencyContactRelationship || "",
        },
      }
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || "Failed to save patient")
      const patientId = result.patient?.id
      if (patientId) {
        router.push(`/dashboard?patient=${patientId}`)
      } else {
        router.push("/dashboard")
      }
    } catch (error) {
      console.error("Registration save failed:", error)
      alert(error instanceof Error ? error.message : "Something went wrong while saving")
    }
  }

  return (
    <RegistrationFlow
      onComplete={handleComplete}
      onBack={() => router.push("/dashboard")}
    />
  )
}
