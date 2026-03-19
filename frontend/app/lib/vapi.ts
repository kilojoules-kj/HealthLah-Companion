import type { Patient } from "@/app/types"

const VAPI_API_KEY = process.env.VAPI_API_KEY!
const VAPI_BASE_URL = "https://api.vapi.ai"

/** Normalize to E.164 for VAPI. Supports SG (+65) and international formats. */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  // Singapore numbers: 8 digits
  if (digits.length === 8 && (digits.startsWith("6") || digits.startsWith("8") || digits.startsWith("9"))) {
    return `+65${digits}`
  }
  // US numbers
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  if (phone.startsWith("+")) return phone
  return `+${digits}`
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

export async function initiateCall(patient: Patient): Promise<{ callId: string }> {
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID
  
  if (!phoneNumberId) {
    throw new Error("VAPI_PHONE_NUMBER_ID environment variable is not set. Please add it to your environment variables.")
  }
  
  if (!isValidUUID(phoneNumberId)) {
    throw new Error(`VAPI_PHONE_NUMBER_ID must be a valid UUID. Current value: ${phoneNumberId}`)
  }
  
  const number = toE164(patient.phone)
  const response = await fetch(`${VAPI_BASE_URL}/call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistantId: process.env.VAPI_ASSISTANT_ID,
      phoneNumberId,
      customer: {
        number,
        name: patient.name,
      },
      assistantOverrides: {
        variableValues: {
          patient_name: patient.name,
          patient_age: patient.age,
          biography: patient.biography,
          hobbies: patient.hobbies?.join(", "),
          family_members: JSON.stringify(patient.family_members),
          medications: JSON.stringify(patient.medications),
          personality_notes: patient.personality_notes,
          preferred_language: patient.preferred_language || "English",
          conditions: patient.conditions?.join(", ") || "",
        },
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`VAPI call failed: ${error}`)
  }

  const data = await response.json()
  return { callId: data.id }
}

/** Initiate an outbound phone call to a number you provide. Requires VAPI_PHONE_NUMBER_ID. */
export async function initiateOutboundCall(
  phoneNumber: string,
  options?: { name?: string; variableValues?: Record<string, string> }
): Promise<{ callId: string }> {
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID
  if (!phoneNumberId) {
    throw new Error("VAPI_PHONE_NUMBER_ID is required for outbound phone calls. Set it in your environment variables.")
  }
  
  if (!isValidUUID(phoneNumberId)) {
    throw new Error(`VAPI_PHONE_NUMBER_ID must be a valid UUID. Current value: ${phoneNumberId}`)
  }
  const name = options?.name?.trim() || "Guest"
  const variableValues = options?.variableValues ?? {}
  const number = toE164(phoneNumber.trim())
  const response = await fetch(`${VAPI_BASE_URL}/call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistantId: process.env.VAPI_ASSISTANT_ID,
      phoneNumberId,
      customer: {
        number,
        name,
      },
      assistantOverrides: {
        variableValues: {
          patient_name: name,
          patient_age: variableValues.patient_age ?? "",
          biography: variableValues.biography ?? "",
          hobbies: variableValues.hobbies ?? "",
          family_members: variableValues.family_members ?? "{}",
          medications: variableValues.medications ?? "[]",
          personality_notes: variableValues.personality_notes ?? "",
          preferred_language: variableValues.preferred_language ?? "English",
          conditions: variableValues.conditions ?? "",
          ...variableValues,
        },
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`VAPI outbound call failed: ${error}`)
  }

  const data = await response.json()
  return { callId: data.id }
}

export async function getCallDetails(callId: string) {
  const response = await fetch(`${VAPI_BASE_URL}/call/${callId}`, {
    headers: {
      Authorization: `Bearer ${VAPI_API_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch call details")
  }

  return response.json()
}
