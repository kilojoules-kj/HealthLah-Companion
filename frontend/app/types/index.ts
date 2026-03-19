export interface Patient {
  id: string
  caregiver_id: string
  name: string
  age: number
  phone: string
  /** Optional location e.g. "Singapore" */
  location?: string
  biography: string
  hobbies: string[]
  family_members: Record<string, any>
  medications: Medication[]
  call_schedule: CallSchedule
  personality_notes: string
  risk_flags: string[]
  /** Preferred language for calls e.g. "Mandarin", "English", "Malay", "Tamil" */
  preferred_language?: string
  /** Chronic conditions e.g. ["Type 2 Diabetes", "Hypertension", "CKD Stage 3"] */
  conditions?: string[]
  /** Emergency contact info */
  emergency_contact?: EmergencyContact
  created_at: string
}

export interface EmergencyContact {
  name: string
  phone: string
  relationship: string
}

export interface Medication {
  name: string
  time: string
  dosage?: string
}

export interface CallSchedule {
  times: string[]
  days?: string[]
  timezone?: string
}

export interface CallLog {
  id: string
  patient_id: string
  vapi_call_id: string
  started_at: string
  ended_at: string
  duration_seconds: number
  transcript: string
  summary: string
  mood_score: number
  medication_confirmed: boolean
  memories_extracted: any[]
  concern_flags: string[]
  created_at: string
}

export interface Memory {
  id: string
  patient_id: string
  call_id: string
  memory_text: string
  category: string
  date_mentioned: string
  sentiment: string
  created_at: string
}

/** Form/UI shape for adding a medication reminder (registration flow) */
export interface MedicationReminder {
  id: string
  name: string
  time: string
  days: string[]
  dosage?: string
}

export interface PatientData {
  id: string
  firstName: string
  lastName: string
  phone: string
  dateOfBirth: string
  location: string
  relationship: string
  thingsTheyLove: string
  medicationSchedule: MedicationReminder[]
  preferredLanguage: string
  conditions: string[]
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelationship: string
}

/** Form data for creating a new patient (before saving to DB) */
export interface PatientFormData {
  firstName: string
  lastName: string
  phone: string
  dateOfBirth: string
  location: string
  relationship: string
  thingsTheyLove: string
  medicationSchedule: MedicationReminder[]
  preferredLanguage: string
  conditions: string[]
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelationship: string
}

export interface CaregiverData {
  firstName: string
  lastName: string
  email: string
  phone: string
}
