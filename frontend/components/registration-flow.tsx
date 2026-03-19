"use client"

import { useState } from "react"
import { Check, ArrowRight, ArrowLeft, Phone, Calendar, Heart, Plus, X, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PatientFormData, CaregiverData, MedicationReminder } from "@/app/types"

interface RegistrationFlowProps {
  onComplete: (patient: PatientFormData, caregiver: CaregiverData) => void
  onBack?: () => void
}

const steps = [
  { id: 1, name: "Your account" },
  { id: 2, name: "Patient details" },
  { id: 3, name: "Confirm link" },
  { id: 4, name: "Done" },
]

export function RegistrationFlow({ onComplete, onBack }: RegistrationFlowProps) {
  const [currentStep, setCurrentStep] = useState(1)
  
  // Caregiver data
  const [caregiverFirstName, setCaregiverFirstName] = useState("")
  const [caregiverLastName, setCaregiverLastName] = useState("")
  const [caregiverEmail, setCaregiverEmail] = useState("")
  const [caregiverPhone, setCaregiverPhone] = useState("")
  const [caregiverPassword, setCaregiverPassword] = useState("")
  const [caregiverConsent, setCaregiverConsent] = useState(false)
  
  // Patient data
  const [patientFirstName, setPatientFirstName] = useState("")
  const [patientLastName, setPatientLastName] = useState("")
  const [patientPhone, setPatientPhone] = useState("")
  const [patientDOB, setPatientDOB] = useState("")
  const [patientLocation, setPatientLocation] = useState("")
  const [relationship, setRelationship] = useState("")
  const [thingsTheyLove, setThingsTheyLove] = useState("")
  const [patientConsent, setPatientConsent] = useState(false)
  const [medicationSchedule, setMedicationSchedule] = useState<MedicationReminder[]>([])
  const [preferredLanguage, setPreferredLanguage] = useState("")
  const [conditions, setConditions] = useState<string[]>([])
  const [emergencyContactName, setEmergencyContactName] = useState("")
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("")
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState("")

  // SMS alerts toggle
  const [smsAlerts, setSmsAlerts] = useState(true)

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    } else if (onBack) {
      onBack()
    }
  }

  const handleComplete = () => {
    onComplete(
      {
        firstName: patientFirstName,
        lastName: patientLastName,
        phone: patientPhone,
        dateOfBirth: patientDOB,
        location: patientLocation,
        relationship,
        thingsTheyLove,
        medicationSchedule,
        preferredLanguage,
        conditions,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelationship,
      },
      {
        firstName: caregiverFirstName,
        lastName: caregiverLastName,
        email: caregiverEmail,
        phone: caregiverPhone,
      }
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-8 px-4">
      {/* Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
            <Heart className="w-5 h-5" />
          </div>
          <span className="text-xl font-semibold text-foreground font-heading">HealthLah</span>
        </div>
        <p className="text-muted-foreground text-sm font-mono">Your Health Matters, Lah!</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step.id < currentStep
                    ? "bg-primary text-primary-foreground"
                    : step.id === currentStep
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border-2 border-border text-muted-foreground"
                }`}
              >
                {step.id < currentStep ? (
                  <Check className="w-4 h-4" />
                ) : (
                  step.id
                )}
              </div>
              <span
                className={`text-xs mt-1 font-mono ${
                  step.id === currentStep
                    ? "text-primary font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {step.name}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-2 mt-4.5 ${
                  step.id < currentStep ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Form Card */}
      <div className="w-full max-w-xl paper-card p-8">
        {currentStep === 1 && (
          <Step1Caregiver
            firstName={caregiverFirstName}
            setFirstName={setCaregiverFirstName}
            lastName={caregiverLastName}
            setLastName={setCaregiverLastName}
            email={caregiverEmail}
            setEmail={setCaregiverEmail}
            phone={caregiverPhone}
            setPhone={setCaregiverPhone}
            password={caregiverPassword}
            setPassword={setCaregiverPassword}
            consent={caregiverConsent}
            setConsent={setCaregiverConsent}
            onNext={handleNext}
          />
        )}

        {currentStep === 2 && (
          <Step2Patient
            firstName={patientFirstName}
            setFirstName={setPatientFirstName}
            lastName={patientLastName}
            setLastName={setPatientLastName}
            phone={patientPhone}
            setPhone={setPatientPhone}
            dob={patientDOB}
            setDOB={setPatientDOB}
            location={patientLocation}
            setLocation={setPatientLocation}
            relationship={relationship}
            setRelationship={setRelationship}
            thingsTheyLove={thingsTheyLove}
            setThingsTheyLove={setThingsTheyLove}
            medicationSchedule={medicationSchedule}
            setMedicationSchedule={setMedicationSchedule}
            preferredLanguage={preferredLanguage}
            setPreferredLanguage={setPreferredLanguage}
            conditions={conditions}
            setConditions={setConditions}
            emergencyContactName={emergencyContactName}
            setEmergencyContactName={setEmergencyContactName}
            emergencyContactPhone={emergencyContactPhone}
            setEmergencyContactPhone={setEmergencyContactPhone}
            emergencyContactRelationship={emergencyContactRelationship}
            setEmergencyContactRelationship={setEmergencyContactRelationship}
            consent={patientConsent}
            setConsent={setPatientConsent}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === 3 && (
          <Step3Confirm
            caregiverName={`${caregiverFirstName} ${caregiverLastName}`}
            patientName={`${patientFirstName} ${patientLastName}`}
            patientPhone={patientPhone}
            smsAlerts={smsAlerts}
            setSmsAlerts={setSmsAlerts}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === 4 && (
          <Step4Done
            patientName={`${patientFirstName} ${patientLastName}`}
            onGoToDashboard={handleComplete}
          />
        )}
      </div>
    </div>
  )
}

// Step 1: Caregiver Account
function Step1Caregiver({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  setEmail,
  phone,
  setPhone,
  password,
  setPassword,
  consent,
  setConsent,
  onNext,
}: {
  firstName: string
  setFirstName: (v: string) => void
  lastName: string
  setLastName: (v: string) => void
  email: string
  setEmail: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  password: string
  setPassword: (v: string) => void
  consent: boolean
  setConsent: (v: boolean) => void
  onNext: () => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">Create your caregiver/family account</h2>
        <p className="text-muted-foreground text-sm">
          You&apos;ll use this to access call summaries, stories, and mood alerts.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">First name</label>
          <Input
            placeholder="Mei Ling"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="bg-white border-border"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Last name</label>
          <Input
            placeholder="Tan"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="bg-white border-border"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Email address</label>
        <Input
          type="email"
          placeholder="meiling@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-white border-border"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Phone number (for SMS alerts)</label>
        <Input
          type="tel"
          placeholder="+65 9123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="bg-white border-border"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Password</label>
        <Input
          type="password"
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-white border-border"
        />
      </div>

      <div className="h-px bg-border" />

      <div className="bg-secondary rounded-lg p-4 flex items-start gap-3">
        <Checkbox
          checked={consent}
          onCheckedChange={(checked) => setConsent(checked as boolean)}
          className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
        <label className="text-sm text-foreground leading-relaxed">
          I confirm that I have permission to enroll a patient family member and will obtain their verbal consent before their first call.
        </label>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={onNext}
          className="bg-foreground text-white hover:bg-foreground/90"
        >
          Continue <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

// Step 2: Add Patient
function Step2Patient({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  phone,
  setPhone,
  dob,
  setDOB,
  location,
  setLocation,
  relationship,
  setRelationship,
  thingsTheyLove,
  setThingsTheyLove,
  medicationSchedule,
  setMedicationSchedule,
  preferredLanguage,
  setPreferredLanguage,
  conditions,
  setConditions,
  emergencyContactName,
  setEmergencyContactName,
  emergencyContactPhone,
  setEmergencyContactPhone,
  emergencyContactRelationship,
  setEmergencyContactRelationship,
  consent,
  setConsent,
  onNext,
  onBack,
}: {
  firstName: string
  setFirstName: (v: string) => void
  lastName: string
  setLastName: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  dob: string
  setDOB: (v: string) => void
  location: string
  setLocation: (v: string) => void
  relationship: string
  setRelationship: (v: string) => void
  thingsTheyLove: string
  setThingsTheyLove: (v: string) => void
  medicationSchedule: MedicationReminder[]
  setMedicationSchedule: (v: MedicationReminder[]) => void
  preferredLanguage: string
  setPreferredLanguage: (v: string) => void
  conditions: string[]
  setConditions: (v: string[]) => void
  emergencyContactName: string
  setEmergencyContactName: (v: string) => void
  emergencyContactPhone: string
  setEmergencyContactPhone: (v: string) => void
  emergencyContactRelationship: string
  setEmergencyContactRelationship: (v: string) => void
  consent: boolean
  setConsent: (v: boolean) => void
  onNext: () => void
  onBack: () => void
}) {
  const [showAddMed, setShowAddMed] = useState(false)
  const [newMedName, setNewMedName] = useState("")
  const [newMedTime, setNewMedTime] = useState("08:00")
  const [newMedDays, setNewMedDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  const addMedication = () => {
    if (newMedName.trim()) {
      setMedicationSchedule([
        ...medicationSchedule,
        {
          id: Date.now().toString(),
          name: newMedName,
          time: newMedTime,
          days: newMedDays,
        },
      ])
      setNewMedName("")
      setNewMedTime("08:00")
      setNewMedDays(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
      setShowAddMed(false)
    }
  }

  const removeMedication = (id: string) => {
    setMedicationSchedule(medicationSchedule.filter((m) => m.id !== id))
  }

  const toggleDay = (day: string) => {
    if (newMedDays.includes(day)) {
      setNewMedDays(newMedDays.filter((d) => d !== day))
    } else {
      setNewMedDays([...newMedDays, day])
    }
  }

  const availableConditions = [
    "Type 2 Diabetes",
    "Hypertension",
    "CKD (Chronic Kidney Disease)",
    "Heart Disease",
    "COPD",
    "Asthma",
    "Stroke History",
    "Hyperlipidemia",
    "Arthritis",
    "Dementia",
    "Depression",
    "Other",
  ]

  const toggleCondition = (condition: string) => {
    if (conditions.includes(condition)) {
      setConditions(conditions.filter((c) => c !== condition))
    } else {
      setConditions([...conditions, condition])
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">Add your patient&apos;s details</h2>
        <p className="text-muted-foreground text-sm">
          HealthLah will call them at this number. No app or smartphone needed. Just a regular phone call in their preferred language.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">First name</label>
          <Input
            placeholder="Ah Kow"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="bg-white border-border"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Last name</label>
          <Input
            placeholder="Tan"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="bg-white border-border"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Their phone number (landline or cell)</label>
        <Input
          type="tel"
          placeholder="+65 8234 5678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="bg-white border-border"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Date of birth</label>
        <Input
          type="date"
          value={dob}
          onChange={(e) => setDOB(e.target.value)}
          className="bg-white border-border"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Location</label>
        <Input
          placeholder="e.g. Bedok, Singapore"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="bg-white border-border"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Preferred language for calls</label>
        <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
          <SelectTrigger className="w-full bg-white border-border">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="English">English</SelectItem>
            <SelectItem value="Mandarin">Mandarin (华语)</SelectItem>
            <SelectItem value="Malay">Malay (Bahasa Melayu)</SelectItem>
            <SelectItem value="Tamil">Tamil (தமிழ்)</SelectItem>
            <SelectItem value="Hokkien">Hokkien (福建话)</SelectItem>
            <SelectItem value="Cantonese">Cantonese (广东话)</SelectItem>
            <SelectItem value="Teochew">Teochew (潮州话)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground">Chronic conditions</label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select all that apply so HealthLah can tailor health check-ins.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableConditions.map((condition) => (
            <button
              key={condition}
              type="button"
              onClick={() => toggleCondition(condition)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                conditions.includes(condition)
                  ? "bg-primary text-white"
                  : "bg-card border border-border text-muted-foreground hover:border-primary"
              }`}
            >
              {condition}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground">Emergency contact (optional)</label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Someone to notify in case of urgent health concerns detected during calls.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input
              placeholder="e.g. Dr. Lim"
              value={emergencyContactName}
              onChange={(e) => setEmergencyContactName(e.target.value)}
              className="bg-white border-border"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Relationship</label>
            <Input
              placeholder="e.g. Family doctor"
              value={emergencyContactRelationship}
              onChange={(e) => setEmergencyContactRelationship(e.target.value)}
              className="bg-white border-border"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Phone number</label>
          <Input
            type="tel"
            placeholder="+65 6234 5678"
            value={emergencyContactPhone}
            onChange={(e) => setEmergencyContactPhone(e.target.value)}
            className="bg-white border-border"
          />
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Your relationship to them</label>
        <Select value={relationship} onValueChange={setRelationship}>
          <SelectTrigger className="w-full bg-white border-border">
            <SelectValue placeholder="Select relationship" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="grandchild">Grandchild</SelectItem>
            <SelectItem value="child">Son/Daughter</SelectItem>
            <SelectItem value="niece-nephew">Niece/Nephew</SelectItem>
            <SelectItem value="spouse">Spouse</SelectItem>
            <SelectItem value="sibling">Sibling</SelectItem>
            <SelectItem value="friend">Close Friend</SelectItem>
            <SelectItem value="caregiver">Professional Caregiver</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">A few things they love (optional)</label>
        <Input
          placeholder="e.g. tai chi, reading newspapers, kopi..."
          value={thingsTheyLove}
          onChange={(e) => setThingsTheyLove(e.target.value)}
          className="bg-white border-border"
        />
      </div>

      <div className="h-px bg-border" />

      {/* Medication Schedule Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-foreground">Health Reminders (optional)</label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set up daily reminders so HealthLah can check in about health.
            </p>
          </div>
          {!showAddMed && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddMed(true)}
              className="border-border"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          )}
        </div>

        {/* Add Medication Form */}
        {showAddMed && (
          <div className="bg-background rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">New Health Reminder</span>
              <button
                onClick={() => setShowAddMed(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Health Name</label>
              <Input
                placeholder="e.g. Metformin 500mg"
                value={newMedName}
                onChange={(e) => setNewMedName(e.target.value)}
                className="bg-white border-border"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Reminder time</label>
              <Input
                type="time"
                value={newMedTime}
                onChange={(e) => setNewMedTime(e.target.value)}
                className="bg-white border-border w-32"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Days</label>
              <div className="flex gap-1">
                {daysOfWeek.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`w-9 h-9 rounded-full text-xs font-medium transition-colors ${
                      newMedDays.includes(day)
                        ? "bg-primary text-white"
                        : "bg-card border border-border text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {day.slice(0, 2)}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              onClick={addMedication}
              disabled={!newMedName.trim()}
              className="w-full bg-foreground text-white hover:bg-foreground/90"
            >
              Add Reminder
            </Button>
          </div>
        )}

        {/* List of Added Medications */}
        {medicationSchedule.length > 0 && (
          <div className="space-y-2">
            {medicationSchedule.map((med) => (
              <div
                key={med.id}
                className="flex items-center justify-between bg-white border
                 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <Clock className="w-4 h-4 text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{med.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {med.time} · {med.days.join(", ")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeMedication(med.id)}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-border" />

      <div className="bg-secondary rounded-lg p-4 flex items-start gap-3">
        <Checkbox
          checked={consent}
          onCheckedChange={(checked) => setConsent(checked as boolean)}
          className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
        <label className="text-sm text-foreground leading-relaxed">
          I confirm that {firstName || "they"} {firstName ? "has" : "have"} verbally consented to receiving AI-assisted phone calls through HealthLah and having call summaries shared with me.
        </label>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="border-border">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button
          onClick={onNext}
          className="bg-foreground text-white hover:bg-foreground/90"
        >
          Confirm & link <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

// Step 3: Confirm Link
function Step3Confirm({
  caregiverName,
  patientName,
  patientPhone,
  smsAlerts,
  setSmsAlerts,
  onNext,
  onBack,
}: {
  caregiverName: string
  patientName: string
  patientPhone: string
  smsAlerts: boolean
  setSmsAlerts: (v: boolean) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">Confirm your connection</h2>
        <p className="text-muted-foreground text-sm">
          Review the details below. Here&apos;s exactly what will happen next.
        </p>
      </div>

      {/* Connection Visualization */}
      <div className="bg-background rounded-xl p-6">
        <div className="flex items-center justify-center gap-8">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-2xl font-semibold text-foreground">
              {caregiverName.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <span className="mt-2 text-sm font-medium text-foreground">{caregiverName}</span>
            <span className="text-xs text-muted-foreground">Caregiver</span>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-primary" />
              <Heart className="w-5 h-5 text-primary" />
              <div className="w-8 h-0.5 bg-primary" />
            </div>
            <span className="text-xs text-muted-foreground mt-1">Connected</span>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-2xl font-semibold text-foreground">
              {patientName.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <span className="mt-2 text-sm font-medium text-foreground">{patientName}</span>
            <span className="text-xs text-muted-foreground">Patient</span>
          </div>
        </div>
      </div>

      {/* What happens next */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground">What happens next:</h3>
        
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">First call in 10 minutes</p>
              <p className="text-xs text-muted-foreground">
                HealthLah will call {patientName.split(" ")[0]} at {patientPhone || "their number"} for a friendly introduction.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Weekly story PDFs</p>
              <p className="text-xs text-muted-foreground">
                Every Sunday, you&apos;ll receive a beautifully formatted excerpt of stories captured that week.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">SMS mood alerts</p>
                <p className="text-xs text-muted-foreground">
                  Get notified if we detect concerning mood changes.
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setSmsAlerts(!smsAlerts)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    smsAlerts ? "bg-primary" : "bg-border"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      smsAlerts ? "left-5" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="border-border">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button
          onClick={onNext}
          className="bg-primary text-white hover:bg-primary/90"
        >
          Confirm & start <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

// Step 4: Done
function Step4Done({
  patientName,
  onGoToDashboard,
}: {
  patientName: string
  onGoToDashboard: () => void
}) {
  return (
    <div className="text-center space-y-6 py-4">
      <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto">
        <Check className="w-10 h-10 text-primary" />
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">You&apos;re all set!</h2>
        <p className="text-muted-foreground">
          {patientName}&apos;s first call will happen in about 10 minutes. We&apos;ll introduce ourselves gently and start getting to know them.
        </p>
      </div>

      <div className="bg-background rounded-xl p-4 text-left space-y-3">
        <p className="text-sm text-foreground font-medium">What to expect:</p>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            A friendly AI will call {patientName.split(" ")[0]} and have a warm conversation
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            After each call, you&apos;ll see a summary on your dashboard
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            Stories and memories will be captured and formatted for you weekly
          </li>
        </ul>
      </div>

      <Button
        onClick={onGoToDashboard}
        className="bg-foreground text-white hover:bg-foreground/90 w-full"
        size="lg"
      >
        Go to {patientName.split(" ")[0]}&apos;s dashboard <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  )
}
