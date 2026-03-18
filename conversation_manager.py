# conversation_manager.py
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime
from meralion_engine import MERaLiONEngine
from patient_profile import PatientProfile
from tts_engine import TTSEngine
import json
import logging

logger = logging.getLogger(__name__)


class CallPhase(Enum):
    GREETING = "greeting"
    MEDICATION_CHECK = "medication_check"
    SYMPTOM_SCREENING = "symptom_screening"
    LIFESTYLE_CHECK = "lifestyle_check"
    EMOTIONAL_WELLBEING = "emotional_wellbeing"
    WRAP_UP = "wrap_up"
    EMERGENCY = "emergency"
    COMPLETED = "completed"


# Phase transition rules
PHASE_ORDER = [
    CallPhase.GREETING,
    CallPhase.MEDICATION_CHECK,
    CallPhase.SYMPTOM_SCREENING,
    CallPhase.LIFESTYLE_CHECK,
    CallPhase.EMOTIONAL_WELLBEING,
    CallPhase.WRAP_UP,
    CallPhase.COMPLETED,
]

EMERGENCY_KEYWORDS = [
    "chest pain", "cannot breathe", "stroke", "fall down",
    "bleeding", "fainted", "胸口痛", "不能呼吸", "跌倒", "头很晕",
    "sakit dada", "tak boleh nafas",
]


@dataclass
class CallState:
    patient: PatientProfile
    phase: CallPhase = CallPhase.GREETING
    turn_count: int = 0
    turns_in_current_phase: int = 0
    max_turns_per_phase: int = 3          # don't linger too long
    conversation_log: list = field(default_factory=list)
    health_flags: list = field(default_factory=list)
    mood_assessments: list = field(default_factory=list)
    medication_adherence: dict = field(default_factory=dict)
    start_time: datetime = field(default_factory=datetime.now)


class ConversationManager:
    """Manages the entire proactive call flow."""

    def __init__(self, meralion: MERaLiONEngine, tts: TTSEngine):
        self.meralion = meralion
        self.tts = tts
        self.active_calls: dict[str, CallState] = {}

    def start_call(self, patient: PatientProfile) -> dict:
        """Initiate a proactive call to a patient. Returns opening message."""
        state = CallState(patient=patient)
        self.active_calls[patient.id] = state

        # Generate opening greeting
        opening = self._get_opening_message(patient)

        state.conversation_log.append({
            "role": "assistant",
            "content": opening,
            "phase": CallPhase.GREETING.value,
            "timestamp": datetime.now().isoformat(),
        })

        # Convert to speech
        audio_path = self.tts.speak(opening, language=patient.preferred_language)

        return {
            "text": opening,
            "audio_path": audio_path,
            "phase": CallPhase.GREETING.value,
        }

    def process_patient_response(self, patient_id: str, audio_path: str) -> dict:
        """
        Process one turn of patient audio.
        This is called each time the patient finishes speaking.
        """
        state = self.active_calls[patient_id]
        state.turn_count += 1
        state.turns_in_current_phase += 1

        # Build system prompt with patient context
        system_prompt = self._build_system_prompt(state)

        # Build phase-specific instruction
        phase_instruction = self._get_phase_instruction(state)

        # Send to MERaLiON
        result = self.meralion.process_audio_turn(
            audio_path=audio_path,
            system_prompt=system_prompt,
            conversation_history=self._get_history_for_model(state),
            current_phase_instruction=phase_instruction,
        )

        # Log patient's turn
        state.conversation_log.append({
            "role": "user",
            "content": result["transcription"],
            "phase": state.phase.value,
            "timestamp": datetime.now().isoformat(),
            "language_detected": result.get("language_detected", ""),
            "mood": result.get("mood_assessment", ""),
        })

        # Check for emergency
        if self._check_emergency(result):
            return self._handle_emergency(state, result)

        # Collect health intelligence
        if result.get("health_flags"):
            state.health_flags.extend(result["health_flags"])
        if result.get("mood_assessment"):
            state.mood_assessments.append(result["mood_assessment"])
        if result.get("adherence_status"):
            state.medication_adherence[state.phase.value] = result["adherence_status"]

        # Decide: stay in phase or advance?
        should_advance = self._should_advance_phase(state, result)
        if should_advance:
            state.phase = self._next_phase(state.phase)
            state.turns_in_current_phase = 0

        # Get AI response
        ai_response = result["response_to_patient"]

        # Log assistant's turn
        state.conversation_log.append({
            "role": "assistant",
            "content": ai_response,
            "phase": state.phase.value,
            "timestamp": datetime.now().isoformat(),
        })

        # Check if call is complete
        if state.phase == CallPhase.COMPLETED:
            summary = self._finalize_call(state)
            return {
                "text": ai_response,
                "audio_path": self.tts.speak(ai_response, state.patient.preferred_language),
                "phase": "completed",
                "call_summary": summary,
                "health_flags": state.health_flags,
            }

        return {
            "text": ai_response,
            "audio_path": self.tts.speak(ai_response, state.patient.preferred_language),
            "phase": state.phase.value,
            "health_flags": state.health_flags,
            "transcription": result["transcription"],
            "mood": result.get("mood_assessment", ""),
        }

    # ── Prompt Engineering ──────────────────────────────────────

    def _build_system_prompt(self, state: CallState) -> str:
        patient = state.patient
        return f"""You are "Kawan", a warm, caring AI health companion for elderly patients 
in Singapore. You are conducting a daily check-in call.

YOUR PERSONALITY:
- Warm, patient, and encouraging — like a caring neighbour
- Speak naturally, use simple words
- If patient speaks in {patient.preferred_language}, respond in {patient.preferred_language}
- Mix in appropriate local expressions (e.g., "Take care ah!", "好的 好的")
- Never sound clinical or robotic
- Be gently persistent about medication but NEVER judgmental

IMPORTANT RULES:
- If patient reports ANY emergency symptoms (chest pain, stroke signs, 
  difficulty breathing, falls with injury), IMMEDIATELY flag it
- Keep responses SHORT — 2-3 sentences max (they're on a call)
- Always acknowledge what the patient said before moving on
- If patient goes off-topic, gently listen briefly, then guide back

{patient.get_context_prompt()}

CURRENT CALL STATE:
- Phase: {state.phase.value}
- Turn: {state.turn_count}
- Time: {datetime.now().strftime('%I:%M %p')}

OUTPUT FORMAT — you MUST respond in this exact format:
[TRANSCRIPTION] <what the patient said in their audio, transcribed>
[LANGUAGE] <language detected: english/mandarin/malay/hokkien/tamil>
[MOOD] <one of: cheerful/neutral/tired/anxious/sad/confused/distressed>
[ADHERENCE] <if medication phase: taken/not_taken/partial/unclear>
[FLAGS] <comma-separated health concerns, or "none">
[RESPONSE] <your spoken response to the patient — keep it warm and short>"""

    def _get_phase_instruction(self, state: CallState) -> str:
        """Tell MERaLiON what to focus on in current phase."""
        patient = state.patient

        instructions = {
            CallPhase.GREETING: f"""The patient just answered your greeting. 
Listen to their audio carefully. Pay attention to:
- What language/dialect are they speaking?
- Do they sound energetic, tired, confused, or unwell?
- How is their general mood from their voice tone?

Respond warmly and naturally transition to asking about their medication.""",

            CallPhase.MEDICATION_CHECK: f"""You're checking if the patient took their medications.
Today's medications they should have taken: 
{chr(10).join(f'- {m.name} ({m.dosage}) for {m.condition}' for m in patient.get_today_medications())}

Listen for:
- Did they confirm taking meds? Which ones?
- Any mention of side effects?
- If they missed: gently ask why, don't scold

After confirming, naturally transition to asking how they're feeling physically.""",

            CallPhase.SYMPTOM_SCREENING: f"""You're screening for symptoms related to their conditions: {', '.join(patient.conditions)}.
Listen for mentions of:
- Dizziness, headache (hypertension)
- Frequent urination, thirst, blurry vision (diabetes)
- Swelling in legs, fatigue (kidney disease)
- Any pain or new symptoms
- CRITICAL: chest pain, breathlessness, slurred speech → FLAG IMMEDIATELY

Also pay attention to their VOICE:
- Breathlessness while speaking?
- Slurred or confused speech?
- Unusual pauses or difficulty finding words?""",

            CallPhase.LIFESTYLE_CHECK: """Ask about sleep, eating, and physical activity.
Listen for:
- Poor sleep (could indicate pain, anxiety, or sleep apnea)
- Not eating (could indicate depression, nausea from meds, or dental issues)  
- No movement/activity (fall risk, deconditioning)""",

            CallPhase.EMOTIONAL_WELLBEING: """Gently check on their emotional state and social connections.
Listen for:
- Signs of loneliness or isolation
- Mentions of family visits or social activity
- Anxiety about health or appointments
- Any signs of cognitive confusion (repeating themselves, forgetting what you discussed)

Pay special attention to VOICE TONE — sadness, flatness, or withdrawal.""",

            CallPhase.WRAP_UP: f"""Wrap up the call warmly.
- Summarize any action items
- Remind about upcoming appointments: 
{chr(10).join(f'  - Dr. {a.doctor} on {a.datetime.strftime("%A %d %B, %I:%M%p")} at {a.location}' for a in patient.get_upcoming_appointments())}
- Encourage them for the day
- Say goodbye warmly""",
        }
        return instructions.get(state.phase, "Continue the conversation naturally.")

    # ── Phase Control Logic ─────────────────────────────────────

    def _should_advance_phase(self, state: CallState, result: dict) -> bool:
        """Decide whether to move to next conversation phase."""
        # Always advance if we've been in a phase too long
        if state.turns_in_current_phase >= state.max_turns_per_phase:
            return True

        # Phase-specific completion checks
        if state.phase == CallPhase.GREETING:
            return True  # greeting is always 1 turn

        if state.phase == CallPhase.MEDICATION_CHECK:
            adherence = result.get("adherence_status", "")
            return adherence in ["taken", "not_taken", "partial"]

        if state.phase == CallPhase.WRAP_UP:
            return True  # wrap up is always 1 turn

        # Default: advance after 2 turns
        return state.turns_in_current_phase >= 2

    def _next_phase(self, current: CallPhase) -> CallPhase:
        idx = PHASE_ORDER.index(current)
        if idx + 1 < len(PHASE_ORDER):
            return PHASE_ORDER[idx + 1]
        return CallPhase.COMPLETED

    # ── Emergency Handling ──────────────────────────────────────

    def _check_emergency(self, result: dict) -> bool:
        flags = result.get("health_flags", [])
        transcription = result.get("transcription", "").lower()

        for keyword in EMERGENCY_KEYWORDS:
            if keyword in transcription:
                return True

        emergency_flags = ["emergency", "urgent", "critical", "chest pain", "stroke"]
        return any(
            any(ef in flag.lower() for ef in emergency_flags) for flag in flags
        )

    def _handle_emergency(self, state: CallState, result: dict) -> dict:
        state.phase = CallPhase.EMERGENCY

        emergency_response = (
            f"{state.patient.preferred_name}, I hear you. Please stay calm. "
            f"I'm alerting your emergency contact {state.patient.emergency_contact['name']} "
            f"right now. If you feel very unwell, please call 995 for ambulance. "
            f"Stay on the line with me, okay?"
        )

        # Trigger escalation (covered in escalation module)
        try:
            from escalation import trigger_emergency
            trigger_emergency(state.patient, result)
        except ImportError:
            logger.warning("Escalation module not found — emergency alert not sent")

        return {
            "text": emergency_response,
            "audio_path": self.tts.speak(emergency_response, state.patient.preferred_language),
            "phase": "emergency",
            "emergency": True,
            "health_flags": ["EMERGENCY: " + ", ".join(result.get("health_flags", []))],
        }

    # ── Call Finalization ───────────────────────────────────────

    def _finalize_call(self, state: CallState) -> dict:
        """Generate post-call summary and save."""
        summary = {
            "patient_id": state.patient.id,
            "date": state.start_time.isoformat(),
            "duration_turns": state.turn_count,
            "health_flags": state.health_flags,
            "mood_trajectory": state.mood_assessments,
            "medication_adherence": state.medication_adherence,
            "full_transcript": state.conversation_log,
            "summary": self._generate_summary(state),
        }

        # Save to patient history
        state.patient.conversation_history.append({
            "date": state.start_time.strftime("%Y-%m-%d"),
            "summary": summary["summary"],
        })

        # Persist
        self._save_call_record(summary)

        # Cleanup
        del self.active_calls[state.patient.id]

        return summary

    def _generate_summary(self, state: CallState) -> str:
        """Use MERaLiON to generate a concise call summary."""
        transcript_text = "\n".join(
            f"{turn['role'].upper()}: {turn['content']}"
            for turn in state.conversation_log
        )
        # This could be another MERaLiON call for summarization
        # For hackathon, we can use a simpler approach
        return f"Call with {state.patient.preferred_name}: {len(state.health_flags)} flags raised. Mood: {', '.join(state.mood_assessments[-3:])}."

    def _save_call_record(self, summary: dict):
        with open(f"data/calls/{summary['patient_id']}_{summary['date'][:10]}.json", "w") as f:
            json.dump(summary, f, indent=2, default=str)

    def _get_history_for_model(self, state: CallState) -> list:
        """Format conversation log for MERaLiON context window."""
        return [
            {"role": turn["role"], "content": turn["content"]}
            for turn in state.conversation_log[-10:]  # last 10 turns
        ]

    def _get_opening_message(self, patient: PatientProfile) -> str:
        """Generate a natural opening based on patient context."""
        greetings = {
            "english": f"Good morning, {patient.preferred_name}! This is Kawan, your health buddy. How are you feeling today?",
            "mandarin": f"早安，{patient.preferred_name}！我是Kawan，你的健康好朋友。你今天感觉怎么样？",
            "malay": f"Selamat pagi, {patient.preferred_name}! Saya Kawan, teman kesihatan anda. Apa khabar hari ini?",
            "hokkien": f"Good morning, {patient.preferred_name}! 我是Kawan. 你今日感觉怎样？",
        }

        base = greetings.get(patient.preferred_language, greetings["english"])

        # Add continuity from previous calls
        if patient.conversation_history:
            last = patient.conversation_history[-1]
            if "knee pain" in last["summary"].lower():
                base += " How's your knee feeling today — better than yesterday?"
            elif "tired" in last["summary"].lower():
                base += " You mentioned feeling tired yesterday. Did you rest well?"

        return base