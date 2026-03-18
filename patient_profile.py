# patient_profile.py
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime, time
import json

@dataclass
class Medication:
    name: str
    dosage: str
    frequency: str            # "morning", "afternoon", "evening"
    condition: str            # what it's for — explained simply

@dataclass
class Appointment:
    doctor: str
    specialty: str
    datetime: datetime
    location: str

@dataclass
class PatientProfile:
    id: str
    name: str
    preferred_name: str       # "Mr. Tan", "Ah Gong", "Uncle Tan"
    age: int
    preferred_language: str   # "mandarin", "hokkien", "english", "malay"
    conditions: List[str]     # ["Type 2 Diabetes", "Hypertension", "CKD Stage 3"]
    medications: List[Medication]
    appointments: List[Appointment]
    emergency_contact: dict   # {"name": "Mary Tan", "phone": "+6591234567", "relation": "daughter"}
    call_schedule: time       # preferred call time
    conversation_history: List[dict] = field(default_factory=list)

    # Baseline vocal features (built over time)
    vocal_baseline: Optional[dict] = None

    def get_today_medications(self) -> List[Medication]:
        hour = datetime.now().hour
        if hour < 12:
            period = "morning"
        elif hour < 18:
            period = "afternoon"
        else:
            period = "evening"
        return [m for m in self.medications if m.frequency == period]

    def get_upcoming_appointments(self, days=7) -> List[Appointment]:
        now = datetime.now()
        return [a for a in self.appointments
                if 0 <= (a.datetime - now).days <= days]

    def get_context_prompt(self) -> str:
        """Generate patient context for MERaLiON system prompt"""
        meds_str = "\n".join(
            f"  - {m.name} ({m.dosage}): {m.frequency} — for {m.condition}"
            for m in self.medications
        )
        conditions_str = ", ".join(self.conditions)
        upcoming = self.get_upcoming_appointments()
        appt_str = "\n".join(
            f"  - Dr. {a.doctor} ({a.specialty}) on {a.datetime.strftime('%A, %d %B at %I:%M%p')} at {a.location}"
            for a in upcoming
        ) if upcoming else "  No upcoming appointments this week."

        # Include recent conversation summaries for continuity
        recent_history = self.conversation_history[-3:]  # last 3 calls
        history_str = ""
        if recent_history:
            history_str = "\nRecent check-in notes:\n" + "\n".join(
                f"  - {h['date']}: {h['summary']}" for h in recent_history
            )

        return f"""PATIENT PROFILE:
Name: {self.preferred_name}
Age: {self.age}
Preferred language: {self.preferred_language}
Chronic conditions: {conditions_str}

Current medications:
{meds_str}

Upcoming appointments:
{appt_str}
{history_str}"""


def load_patient(patient_id: str) -> PatientProfile:
    with open("data/patients.json") as f:
        data = json.load(f)
    p = data[patient_id]
    return PatientProfile(
        id=patient_id,
        name=p["name"],
        preferred_name=p["preferred_name"],
        age=p["age"],
        preferred_language=p["preferred_language"],
        conditions=p["conditions"],
        medications=[Medication(**m) for m in p["medications"]],
        appointments=[
            Appointment(**{**a, "datetime": datetime.fromisoformat(a["datetime"])})
            for a in p["appointments"]
        ],
        emergency_contact=p["emergency_contact"],
        call_schedule=time.fromisoformat(p["call_schedule"]),
        conversation_history=p.get("conversation_history", []),
    )