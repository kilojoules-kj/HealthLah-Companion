"""
meralion_engine.py — MERaLiON-Powered Multilingual Vocal Biomarker Caretaker Engine
=====================================================================================

Hackathon Theme: "Empower Patients, Enable Community, Elevate Healthcare"

Architecture
────────────
  Daily Proactive Call (Audio)
         │
         ▼
  ┌─────────────────────────────┐
  │   MERaLiON AudioLLM         │
  │   (audio → understanding    │
  │          → response)        │
  └──────┬──────┬──────┬────────┘
         │      │      │
         ▼      ▼      ▼
   Content   Vocal   Emotional
   Analysis  Bio-    Tone
             marker  Analysis
         │      │      │
         ▼      ▼      ▼
  ┌─────────────────────────────┐
  │   Health Risk Assessor       │
  │   + Alert System             │
  │   + Trending / Longitudinal  │
  └─────────────────────────────┘
         │
         ▼
  Caregiver Dashboard / Alerts

Supports: English, Mandarin, Malay, Tamil, and other SEA languages
Target:   Mr. Tan (60s, multi-chronic), caregivers, pre-conditioned individuals
"""

from __future__ import annotations

import io
import json
import logging
import time
import uuid
import warnings
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import torch

# ──────────────────────────────────────────────
# Optional heavy imports — guarded for CI / demo
# ──────────────────────────────────────────────
try:
    import librosa
    HAS_LIBROSA = True
except ImportError:
    HAS_LIBROSA = False
    warnings.warn("librosa not installed – vocal biomarker extraction will use fallback stubs.")

try:
    import parselmouth          # Praat bindings for clinical voice analysis
    from parselmouth.praat import call as praat_call
    HAS_PARSELMOUTH = True
except ImportError:
    HAS_PARSELMOUTH = False
    warnings.warn("parselmouth not installed – jitter/shimmer analysis unavailable.")

try:
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        AutoProcessor,
        WhisperFeatureExtractor,
    )
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False
    warnings.warn("transformers not installed – MERaLiON model will run in mock mode.")


logger = logging.getLogger("VocalBiomarkerCaretaker")
logger.setLevel(logging.INFO)
if not logger.handlers:
    _ch = logging.StreamHandler()
    _ch.setFormatter(logging.Formatter("[%(asctime)s] %(name)s %(levelname)s: %(message)s"))
    logger.addHandler(_ch)


# ═══════════════════════════════════════════════
# 1.  CONFIGURATION
# ═══════════════════════════════════════════════

@dataclass
class EngineConfig:
    """Central configuration — tweak per deployment / demo."""

    # ── MERaLiON model ──────────────────────────
    model_id: str = "aisingapore/MERaLiON-AudioLLM-Whisper-SEA-LION-instruct"
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
    torch_dtype: str = "float16" if torch.cuda.is_available() else "float32"
    max_new_tokens: int = 512
    temperature: float = 0.3          # low = more deterministic health answers
    trust_remote_code: bool = True

    # ── Audio ───────────────────────────────────
    target_sr: int = 16_000           # MERaLiON / Whisper expects 16 kHz
    max_audio_duration_s: float = 120.0
    min_audio_duration_s: float = 1.0

    # ── Vocal biomarker thresholds ──────────────
    # Reference ranges (population norms); flag if outside
    pitch_mean_low_hz: float = 75.0
    pitch_mean_high_hz: float = 300.0
    jitter_warn_pct: float = 1.04     # >1.04 % → potential laryngeal / neuro issue
    shimmer_warn_pct: float = 3.81
    hnr_warn_db: float = 20.0        # < 20 dB → breathy / hoarse
    speech_rate_low_wpm: int = 100    # < 100 → cognitive / motor slowdown
    speech_rate_high_wpm: int = 200
    pause_ratio_warn: float = 0.40    # > 40 % silence → fatigue / confusion

    # ── Emotional thresholds ────────────────────
    depression_valence_floor: float = 0.25
    anxiety_arousal_ceil: float = 0.85
    distress_score_ceil: float = 0.70

    # ── Longitudinal trending ───────────────────
    trend_window_days: int = 14
    significant_change_pct: float = 15.0   # % change triggering alert

    # ── Alert priorities ────────────────────────
    alert_cooldown_hours: int = 4     # suppress duplicate alerts within window


# ═══════════════════════════════════════════════
# 2.  DATA MODELS
# ═══════════════════════════════════════════════

class AlertSeverity(str, Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class HealthDomain(str, Enum):
    MEDICATION = "medication_adherence"
    SYMPTOMS = "symptom_report"
    COGNITIVE = "cognitive_function"
    RESPIRATORY = "respiratory"
    CARDIOVASCULAR = "cardiovascular"
    NEUROLOGICAL = "neurological"
    MENTAL_HEALTH = "mental_health"
    MOBILITY = "mobility"
    NUTRITION = "nutrition"
    SLEEP = "sleep"
    SOCIAL = "social_engagement"
    APPOINTMENT = "appointment_awareness"


@dataclass
class VocalBiomarkers:
    """Acoustic measurements extracted directly from the audio signal."""

    # Pitch / F0
    pitch_mean_hz: float = 0.0
    pitch_std_hz: float = 0.0
    pitch_range_hz: float = 0.0
    pitch_slope: float = 0.0          # declining pitch over utterance

    # Perturbation (voice quality)
    jitter_local_pct: float = 0.0     # cycle-to-cycle frequency variation
    shimmer_local_pct: float = 0.0    # cycle-to-cycle amplitude variation
    hnr_db: float = 0.0              # harmonics-to-noise ratio

    # Temporal
    speech_rate_wpm: float = 0.0
    articulation_rate_wpm: float = 0.0   # excludes pauses
    pause_ratio: float = 0.0            # fraction of audio that is silence
    mean_pause_duration_s: float = 0.0
    longest_pause_s: float = 0.0
    num_pauses: int = 0

    # Energy / loudness
    energy_mean_db: float = 0.0
    energy_std_db: float = 0.0
    energy_trend: float = 0.0         # declining energy → fatigue

    # Spectral
    spectral_centroid_hz: float = 0.0
    mfcc_means: List[float] = field(default_factory=list)

    # Meta
    audio_duration_s: float = 0.0
    extraction_time_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EmotionalProfile:
    """Emotional state inferred from vocal + content cues."""

    valence: float = 0.5           # 0 = very negative … 1 = very positive
    arousal: float = 0.5           # 0 = very calm … 1 = very agitated
    dominance: float = 0.5         # 0 = submissive … 1 = dominant

    primary_emotion: str = "neutral"
    emotion_confidence: float = 0.0
    secondary_emotion: Optional[str] = None

    # Clinical flags
    depression_indicators: float = 0.0    # 0–1
    anxiety_indicators: float = 0.0       # 0–1
    confusion_indicators: float = 0.0     # 0–1
    distress_level: float = 0.0           # 0–1

    # From MERaLiON understanding
    expressed_feelings: List[str] = field(default_factory=list)
    llm_emotion_summary: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ContentInsights:
    """Structured health content extracted from patient speech via MERaLiON."""

    # Raw transcript
    transcript: str = ""
    detected_language: str = "en"

    # Medication
    medication_mentioned: List[str] = field(default_factory=list)
    medication_adherence_score: float = -1.0   # 0–1, -1 = not discussed
    missed_doses_reported: int = 0
    side_effects_mentioned: List[str] = field(default_factory=list)

    # Symptoms
    symptoms_reported: List[Dict[str, Any]] = field(default_factory=list)
    # Each: {"symptom": str, "severity": 1-10, "duration": str, "new": bool}
    pain_level: int = -1               # 0–10 scale, -1 = not mentioned

    # Vitals (self-reported)
    self_reported_vitals: Dict[str, Any] = field(default_factory=dict)
    # e.g. {"blood_pressure": "140/90", "blood_sugar": "180 mg/dL"}

    # Lifestyle
    sleep_quality: float = -1.0        # 0–1, -1 = not discussed
    appetite_change: Optional[str] = None   # "increased", "decreased", "normal", None
    activity_level: Optional[str] = None    # "sedentary", "light", "moderate", "active"
    fluid_intake: Optional[str] = None

    # Cognitive
    cognitive_clarity_score: float = -1.0    # 0–1 from response coherence
    confusion_events: List[str] = field(default_factory=list)

    # Social
    social_isolation_risk: float = 0.0
    caregiver_mentioned: bool = False
    family_contact_recent: bool = False

    # Appointments
    appointment_awareness: bool = False
    next_appointment_mentioned: Optional[str] = None

    # Follow-up topics the patient raised
    patient_questions: List[str] = field(default_factory=list)

    # Full LLM analysis
    llm_content_summary: str = ""
    llm_health_concerns: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class HealthAlert:
    """An actionable alert generated from the analysis pipeline."""

    alert_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    severity: AlertSeverity = AlertSeverity.INFO
    domain: HealthDomain = HealthDomain.SYMPTOMS
    title: str = ""
    description: str = ""
    evidence: List[str] = field(default_factory=list)
    recommended_action: str = ""
    notify_caregiver: bool = False
    notify_clinician: bool = False
    patient_message: str = ""          # empathetic message for the patient

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["severity"] = self.severity.value
        d["domain"] = self.domain.value
        return d


@dataclass
class ConversationTurn:
    """A single turn in the proactive call conversation."""

    role: str                   # "system", "assistant", "patient"
    content: str
    audio_path: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class CallAnalysisResult:
    """Complete output from one proactive call session."""

    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str = ""
    call_timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    call_duration_s: float = 0.0

    vocal_biomarkers: VocalBiomarkers = field(default_factory=VocalBiomarkers)
    emotional_profile: EmotionalProfile = field(default_factory=EmotionalProfile)
    content_insights: ContentInsights = field(default_factory=ContentInsights)
    alerts: List[HealthAlert] = field(default_factory=list)

    conversation_history: List[ConversationTurn] = field(default_factory=list)
    overall_risk_score: float = 0.0    # 0 = healthy baseline … 1 = urgent
    risk_trend: str = "stable"          # "improving", "stable", "declining"

    llm_clinician_summary: str = ""     # brief for the doctor
    llm_caregiver_summary: str = ""     # plain-language for family

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "patient_id": self.patient_id,
            "call_timestamp": self.call_timestamp,
            "call_duration_s": self.call_duration_s,
            "vocal_biomarkers": self.vocal_biomarkers.to_dict(),
            "emotional_profile": self.emotional_profile.to_dict(),
            "content_insights": self.content_insights.to_dict(),
            "alerts": [a.to_dict() for a in self.alerts],
            "overall_risk_score": self.overall_risk_score,
            "risk_trend": self.risk_trend,
            "llm_clinician_summary": self.llm_clinician_summary,
            "llm_caregiver_summary": self.llm_caregiver_summary,
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)


# ═══════════════════════════════════════════════
# 3.  VOCAL BIOMARKER EXTRACTOR
# ═══════════════════════════════════════════════

class VocalBiomarkerExtractor:
    """
    Extracts clinically-relevant acoustic features from raw audio.

    Uses librosa for spectral/temporal features and parselmouth (Praat)
    for jitter, shimmer, and HNR — the gold-standard clinical measures.

    These biomarkers can indicate:
      • Parkinson's / neurological decline  →  jitter ↑, shimmer ↑, tremor
      • Respiratory / cardiac issues        →  HNR ↓, breathiness ↑
      • Cognitive decline                   →  speech rate ↓, pause ratio ↑
      • Depression                          →  pitch range ↓, energy ↓, monotone
      • Fatigue                             →  energy trend ↓, speech rate ↓
    """

    def __init__(self, config: EngineConfig):
        self.config = config

    def extract(self, audio: np.ndarray, sr: int) -> VocalBiomarkers:
        """Full extraction pipeline. Returns VocalBiomarkers dataclass."""
        t0 = time.time()
        bio = VocalBiomarkers()
        bio.audio_duration_s = len(audio) / sr

        # ── Pitch / F0 ─────────────────────────
        bio = self._extract_pitch(audio, sr, bio)

        # ── Jitter, Shimmer, HNR (Praat) ───────
        bio = self._extract_perturbation(audio, sr, bio)

        # ── Temporal / speech rate ──────────────
        bio = self._extract_temporal(audio, sr, bio)

        # ── Energy / loudness ───────────────────
        bio = self._extract_energy(audio, sr, bio)

        # ── Spectral features ──────────────────
        bio = self._extract_spectral(audio, sr, bio)

        bio.extraction_time_ms = (time.time() - t0) * 1000
        return bio

    # ── Private extraction methods ──────────────

    def _extract_pitch(self, audio: np.ndarray, sr: int, bio: VocalBiomarkers) -> VocalBiomarkers:
        """Extract F0 contour using librosa's pyin or parselmouth."""
        try:
            if HAS_PARSELMOUTH:
                snd = parselmouth.Sound(audio, sampling_frequency=sr)
                pitch_obj = snd.to_pitch(time_step=0.01)
                pitch_values = pitch_obj.selected_array["frequency"]
                voiced = pitch_values[pitch_values > 0]
            elif HAS_LIBROSA:
                f0, voiced_flag, _ = librosa.pyin(
                    audio, fmin=50, fmax=500, sr=sr, frame_length=2048
                )
                voiced = f0[~np.isnan(f0)] if f0 is not None else np.array([])
            else:
                return bio

            if len(voiced) > 2:
                bio.pitch_mean_hz = float(np.mean(voiced))
                bio.pitch_std_hz = float(np.std(voiced))
                bio.pitch_range_hz = float(np.ptp(voiced))
                # Slope: linear regression of pitch over time → declining = fatigue
                x = np.arange(len(voiced))
                coeffs = np.polyfit(x, voiced, 1)
                bio.pitch_slope = float(coeffs[0])

        except Exception as e:
            logger.warning(f"Pitch extraction failed: {e}")
        return bio

    def _extract_perturbation(self, audio: np.ndarray, sr: int, bio: VocalBiomarkers) -> VocalBiomarkers:
        """Jitter, shimmer, HNR via Praat — clinical voice quality measures."""
        if not HAS_PARSELMOUTH:
            return bio
        try:
            snd = parselmouth.Sound(audio, sampling_frequency=sr)
            pitch_obj = snd.to_pitch(time_step=0.01)
            point_process = praat_call(
                snd, "To PointProcess (periodic, cc)", 75, 500
            )
            # Jitter (local %)
            bio.jitter_local_pct = praat_call(
                point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3
            ) * 100
            # Shimmer (local %)
            bio.shimmer_local_pct = praat_call(
                [snd, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6
            ) * 100
            # Harmonics-to-Noise Ratio
            harmonicity = praat_call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
            bio.hnr_db = praat_call(harmonicity, "Get mean", 0, 0)

        except Exception as e:
            logger.warning(f"Perturbation extraction failed: {e}")
        return bio

    def _extract_temporal(self, audio: np.ndarray, sr: int, bio: VocalBiomarkers) -> VocalBiomarkers:
        """Speech rate, pause analysis — cognitive and motor indicators."""
        if not HAS_LIBROSA:
            return bio
        try:
            # Voice Activity Detection via energy thresholding
            hop = 512
            rms = librosa.feature.rms(y=audio, hop_length=hop)[0]
            threshold = np.mean(rms) * 0.4
            is_speech = rms > threshold
            frame_dur = hop / sr

            total_frames = len(is_speech)
            speech_frames = np.sum(is_speech)
            silence_frames = total_frames - speech_frames

            bio.pause_ratio = float(silence_frames / max(total_frames, 1))

            # Identify individual pauses
            pauses = []
            in_pause = False
            pause_start = 0
            for i, sp in enumerate(is_speech):
                if not sp and not in_pause:
                    in_pause = True
                    pause_start = i
                elif sp and in_pause:
                    in_pause = False
                    pause_dur = (i - pause_start) * frame_dur
                    if pause_dur > 0.15:   # ignore micro-pauses < 150ms
                        pauses.append(pause_dur)
            if in_pause:
                pauses.append((len(is_speech) - pause_start) * frame_dur)

            bio.num_pauses = len(pauses)
            if pauses:
                bio.mean_pause_duration_s = float(np.mean(pauses))
                bio.longest_pause_s = float(np.max(pauses))

            # Estimate speech rate (rough: using onset detection as proxy for syllables)
            onsets = librosa.onset.onset_detect(y=audio, sr=sr, hop_length=hop)
            speech_duration_s = speech_frames * frame_dur
            if speech_duration_s > 0:
                syllables_per_sec = len(onsets) / speech_duration_s
                bio.articulation_rate_wpm = float(syllables_per_sec * 60 / 1.5)
                bio.speech_rate_wpm = float(
                    len(onsets) / (bio.audio_duration_s / 60) / 1.5
                )

        except Exception as e:
            logger.warning(f"Temporal extraction failed: {e}")
        return bio

    def _extract_energy(self, audio: np.ndarray, sr: int, bio: VocalBiomarkers) -> VocalBiomarkers:
        """Loudness and energy contour — fatigue and respiratory indicators."""
        if not HAS_LIBROSA:
            return bio
        try:
            rms = librosa.feature.rms(y=audio, hop_length=512)[0]
            rms_db = librosa.amplitude_to_db(rms + 1e-10)
            bio.energy_mean_db = float(np.mean(rms_db))
            bio.energy_std_db = float(np.std(rms_db))
            # Trend: linear regression slope of energy
            x = np.arange(len(rms_db))
            coeffs = np.polyfit(x, rms_db, 1)
            bio.energy_trend = float(coeffs[0])   # negative = declining energy
        except Exception as e:
            logger.warning(f"Energy extraction failed: {e}")
        return bio

    def _extract_spectral(self, audio: np.ndarray, sr: int, bio: VocalBiomarkers) -> VocalBiomarkers:
        """Spectral centroid and MFCCs — voice quality fingerprint."""
        if not HAS_LIBROSA:
            return bio
        try:
            cent = librosa.feature.spectral_centroid(y=audio, sr=sr)[0]
            bio.spectral_centroid_hz = float(np.mean(cent))

            mfccs = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=13)
            bio.mfcc_means = [float(m) for m in np.mean(mfccs, axis=1)]
        except Exception as e:
            logger.warning(f"Spectral extraction failed: {e}")
        return bio


# ═══════════════════════════════════════════════
# 4.  PROMPT TEMPLATES FOR HEALTH ANALYSIS
# ═══════════════════════════════════════════════

PROMPT_TEMPLATES = {
    # ── Proactive greeting (TTS output) ─────────
    "greeting_en": (
        "Good morning, {name}! This is your daily health check-in. "
        "How are you feeling today? Did you take your morning medications?"
    ),
    "greeting_zh": (
        "早上好，{name}！这是您的每日健康检查。"
        "您今天感觉怎么样？您吃了早上的药了吗？"
    ),
    "greeting_ms": (
        "Selamat pagi, {name}! Ini adalah pemeriksaan kesihatan harian anda. "
        "Bagaimana perasaan anda hari ini? Sudahkah anda mengambil ubat pagi?"
    ),
    "greeting_ta": (
        "காலை வணக்கம், {name}! இது உங்கள் தினசரி உடல்நலப் பரிசோதனை. "
        "இன்று எப்படி உணர்கிறீர்கள்? காலை மருந்துகளை எடுத்துக்கொண்டீர்களா?"
    ),

    # ── Content extraction ──────────────────────
    "content_analysis": """You are a healthcare AI assistant analyzing a patient's spoken response during a daily health check-in call.

Listen to the patient's audio carefully and extract the following information in JSON format:
{{
  "transcript": "<full transcript of what the patient said>",
  "detected_language": "<language code: en/zh/ms/ta>",
  "medication_mentioned": ["<list of any medications mentioned>"],
  "medication_taken_today": <true/false/null if not discussed>,
  "missed_doses": <number or null>,
  "side_effects": ["<any side effects mentioned>"],
  "symptoms": [
    {{"symptom": "<name>", "severity_1_10": <int>, "duration": "<text>", "is_new": <bool>}}
  ],
  "pain_level_0_10": <int or null>,
  "self_reported_vitals": {{"<vital>": "<value>"}},
  "sleep_quality_description": "<text or null>",
  "appetite": "<increased/decreased/normal/null>",
  "activity_level": "<sedentary/light/moderate/active/null>",
  "mentioned_family_or_caregiver": <true/false>,
  "appointment_awareness": <true/false>,
  "patient_questions": ["<any questions the patient asked>"],
  "health_concerns": ["<any concerns expressed>"],
  "summary": "<2-3 sentence summary of the patient's state>"
}}

Be thorough. If something is not mentioned, use null. Respond ONLY with valid JSON.""",

    # ── Emotional analysis ─────────────────────
    "emotion_analysis": """You are an expert in vocal emotion recognition analyzing a patient's speech during a healthcare check-in.

Listen to the audio and assess the patient's emotional state. Consider:
- Tone of voice, speech patterns, word choice
- Signs of depression (flat affect, monotone, hopelessness)
- Signs of anxiety (rushed speech, worry, uncertainty)
- Signs of confusion (incoherent, disoriented, repeating)
- Signs of distress or pain (strained voice, groaning)

Respond in JSON:
{{
  "primary_emotion": "<emotion>",
  "emotion_confidence": <0.0-1.0>,
  "secondary_emotion": "<emotion or null>",
  "valence": <0.0 negative to 1.0 positive>,
  "arousal": <0.0 calm to 1.0 agitated>,
  "depression_indicators": <0.0 to 1.0>,
  "anxiety_indicators": <0.0 to 1.0>,
  "confusion_indicators": <0.0 to 1.0>,
  "distress_level": <0.0 to 1.0>,
  "expressed_feelings": ["<feelings the patient expressed>"],
  "summary": "<brief emotional assessment>"
}}

Respond ONLY with valid JSON.""",

    # ── Follow-up question generation ──────────
    "followup_generation": """You are a caring healthcare AI conducting a daily check-in call with {name}, 
a {age}-year-old patient managing {conditions}.

Based on what the patient just said, generate an empathetic follow-up question or response.
The patient's language is {language}.

Guidelines:
- Be warm, patient, and encouraging
- If they reported a symptom, ask clarifying questions (severity, duration, when it started)
- If they missed medication, gently remind them why it's important
- If they sound distressed, acknowledge their feelings first
- Keep responses concise (2-3 sentences max) — this is a phone call
- Respond in the SAME LANGUAGE the patient used

Patient said: "{patient_response}"
Your analysis so far: {analysis_context}

Generate your spoken response:""",

    # ── Clinician summary ─────────────────────
    "clinician_summary": """Summarize this daily health check-in for the attending clinician.

Patient: {name}, {age}y, Conditions: {conditions}
Date: {date}

Vocal Biomarkers:
{biomarkers}

Content Analysis:
{content}

Emotional Analysis:
{emotions}

Write a concise clinical note (3-5 sentences) highlighting:
1. Any concerning changes from baseline
2. Medication adherence status
3. New or worsening symptoms
4. Emotional/cognitive state
5. Recommended actions

Clinical Note:""",

    # ── Caregiver summary (plain language) ────
    "caregiver_summary": """Write a simple, caring summary of today's health check-in for {name}'s family caregiver.
Use plain language (no medical jargon). The caregiver speaks {language}.

Key findings:
- Medication: {medication_status}
- How they're feeling: {emotional_state}
- Any concerns: {concerns}
- Appointments: {appointments}

Write 3-4 sentences that a family member would understand. Be reassuring but honest:""",
}


# ═══════════════════════════════════════════════
# 5.  MERaLiON ENGINE — CORE MODEL WRAPPER
# ═══════════════════════════════════════════════

class MERaLiONEngine:
    """
    Wraps the MERaLiON AudioLLM for audio understanding, content extraction,
    emotion analysis, and response generation.

    MERaLiON (Multimodal Empathetic Reasoning and Learning in One Network)
    is an AudioLLM built on Whisper (audio encoder) + SEA-LION (LLM decoder),
    supporting multilingual Southeast Asian speech understanding.
    """

    def __init__(self, config: Optional[EngineConfig] = None):
        self.config = config or EngineConfig()
        self.model = None
        self.processor = None
        self.tokenizer = None
        self._loaded = False

    def load_model(self) -> None:
        """Load MERaLiON model and processor onto the configured device."""
        if self._loaded:
            logger.info("Model already loaded.")
            return

        if not HAS_TRANSFORMERS:
            logger.warning("Transformers not available — running in MOCK mode.")
            self._loaded = True
            return

        logger.info(f"Loading MERaLiON model: {self.config.model_id}")
        logger.info(f"Device: {self.config.device}, dtype: {self.config.torch_dtype}")

        dtype_map = {"float16": torch.float16, "bfloat16": torch.bfloat16, "float32": torch.float32}
        dtype = dtype_map.get(self.config.torch_dtype, torch.float32)

        try:
            self.processor = AutoProcessor.from_pretrained(
                self.config.model_id,
                trust_remote_code=self.config.trust_remote_code,
            )

            self.model = AutoModelForCausalLM.from_pretrained(
                self.config.model_id,
                torch_dtype=dtype,
                device_map="auto" if self.config.device == "cuda" else None,
                trust_remote_code=self.config.trust_remote_code,
            )

            if self.config.device == "cpu":
                self.model = self.model.to(self.config.device)

            self.model.eval()
            self._loaded = True
            logger.info("MERaLiON model loaded successfully.")

        except Exception as e:
            logger.error(f"Failed to load MERaLiON model: {e}")
            logger.info("Falling back to MOCK mode.")
            self._loaded = True   # allow mock operation

    def is_mock_mode(self) -> bool:
        return self.model is None

    # ── Core inference ──────────────────────────

    def infer(
        self,
        audio: np.ndarray,
        sr: int,
        text_prompt: str,
        max_new_tokens: Optional[int] = None,
    ) -> str:
        """
        Send audio + text prompt to MERaLiON and return generated text.

        Parameters
        ----------
        audio : np.ndarray
            Audio waveform, mono, preferably 16 kHz.
        sr : int
            Sample rate of the audio.
        text_prompt : str
            Instruction/question for the model about the audio.
        max_new_tokens : int, optional
            Override default max generation length.

        Returns
        -------
        str
            Model-generated text response.
        """
        if not self._loaded:
            self.load_model()

        # Resample if needed
        if sr != self.config.target_sr and HAS_LIBROSA:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=self.config.target_sr)
            sr = self.config.target_sr

        # Clamp duration
        max_samples = int(self.config.max_audio_duration_s * sr)
        if len(audio) > max_samples:
            logger.warning(f"Audio truncated from {len(audio)/sr:.1f}s to {self.config.max_audio_duration_s}s")
            audio = audio[:max_samples]

        if self.is_mock_mode():
            return self._mock_infer(text_prompt)

        return self._model_infer(audio, sr, text_prompt, max_new_tokens)

    def _model_infer(
        self,
        audio: np.ndarray,
        sr: int,
        text_prompt: str,
        max_new_tokens: Optional[int],
    ) -> str:
        """Actual model inference through MERaLiON."""
        tokens = max_new_tokens or self.config.max_new_tokens

        try:
            # MERaLiON processor expects audio + text
            # The exact API depends on the model version; we handle common patterns
            inputs = self.processor(
                audio=audio,
                sampling_rate=sr,
                text=text_prompt,
                return_tensors="pt",
            )

            # Move inputs to device
            inputs = {k: v.to(self.model.device) if hasattr(v, 'to') else v
                      for k, v in inputs.items()}

            with torch.no_grad():
                output_ids = self.model.generate(
                    **inputs,
                    max_new_tokens=tokens,
                    temperature=self.config.temperature,
                    do_sample=self.config.temperature > 0,
                    top_p=0.9,
                    repetition_penalty=1.1,
                )

            # Decode — skip the input tokens
            input_len = inputs.get("input_ids", torch.tensor([[]])).shape[-1]
            generated_ids = output_ids[0][input_len:]
            response = self.processor.decode(generated_ids, skip_special_tokens=True)

            return response.strip()

        except Exception as e:
            logger.error(f"MERaLiON inference error: {e}")
            return self._mock_infer(text_prompt)

    def _mock_infer(self, text_prompt: str) -> str:
        """Fallback mock responses for development / demo without GPU."""
        if "content" in text_prompt.lower() or "extract" in text_prompt.lower() or "JSON" in text_prompt:
            return json.dumps({
                "transcript": "I'm feeling okay today. A bit tired. I took my blood pressure medicine but I forgot the diabetes one. My knee has been hurting more than usual.",
                "detected_language": "en",
                "medication_mentioned": ["blood pressure medicine", "diabetes medication"],
                "medication_taken_today": True,
                "missed_doses": 1,
                "side_effects": [],
                "symptoms": [
                    {"symptom": "fatigue", "severity_1_10": 4, "duration": "today", "is_new": False},
                    {"symptom": "knee pain", "severity_1_10": 6, "duration": "few days", "is_new": False}
                ],
                "pain_level_0_10": 6,
                "self_reported_vitals": {},
                "sleep_quality_description": None,
                "appetite": None,
                "activity_level": "sedentary",
                "mentioned_family_or_caregiver": False,
                "appointment_awareness": False,
                "patient_questions": [],
                "health_concerns": ["worsening knee pain", "fatigue"],
                "summary": "Patient reports moderate fatigue and worsening knee pain. Took blood pressure medication but missed diabetes dose. Generally stable but showing signs of reduced activity."
            }, ensure_ascii=False)

        elif "emotion" in text_prompt.lower():
            return json.dumps({
                "primary_emotion": "tired",
                "emotion_confidence": 0.72,
                "secondary_emotion": "mildly anxious",
                "valence": 0.38,
                "arousal": 0.30,
                "depression_indicators": 0.35,
                "anxiety_indicators": 0.25,
                "confusion_indicators": 0.10,
                "distress_level": 0.30,
                "expressed_feelings": ["tiredness", "mild discomfort"],
                "summary": "Patient sounds fatigued with slightly low mood. No acute distress but warrants monitoring."
            }, ensure_ascii=False)

        elif "follow" in text_prompt.lower() or "response" in text_prompt.lower():
            return ("I'm sorry to hear your knee has been bothering you more. "
                    "How long has it been getting worse? Also, it's important to take "
                    "your diabetes medication — shall I set a reminder for you?")

        elif "clinician" in text_prompt.lower() or "clinical" in text_prompt.lower():
            return ("Daily check-in note: Patient reports increased fatigue and worsening "
                    "bilateral knee pain (6/10). Partial medication adherence — BP meds taken, "
                    "diabetes medication missed. Low-normal affect with mild fatigue in voice. "
                    "Vocal biomarkers within normal range. Recommend: reinforce diabetes med "
                    "compliance, assess knee pain at next visit, monitor mood trend.")

        elif "caregiver" in text_prompt.lower() or "family" in text_prompt.lower():
            return ("Today's check-in with Dad went okay overall. He's feeling a bit tired "
                    "and his knee pain is bothering him more than usual. He remembered his "
                    "blood pressure medicine but forgot the diabetes one. It might help to "
                    "remind him about his diabetes medication in the morning.")

        return "I understand. Thank you for sharing. Is there anything else you'd like to tell me about how you're feeling?"

    # ── High-level analysis methods ─────────────

    def analyze_content(self, audio: np.ndarray, sr: int) -> ContentInsights:
        """Extract structured health content from patient audio."""
        raw = self.infer(audio, sr, PROMPT_TEMPLATES["content_analysis"])
        insights = ContentInsights()

        try:
            # Parse JSON from model output
            data = self._extract_json(raw)

            insights.transcript = data.get("transcript", "")
            insights.detected_language = data.get("detected_language", "en")
            insights.medication_mentioned = data.get("medication_mentioned", [])
            insights.missed_doses_reported = data.get("missed_doses", 0) or 0
            insights.side_effects_mentioned = data.get("side_effects", [])

            # Medication adherence score
            taken = data.get("medication_taken_today")
            if taken is True:
                insights.medication_adherence_score = 1.0 if insights.missed_doses_reported == 0 else 0.5
            elif taken is False:
                insights.medication_adherence_score = 0.0

            # Symptoms
            for s in data.get("symptoms", []):
                insights.symptoms_reported.append({
                    "symptom": s.get("symptom", "unknown"),
                    "severity": s.get("severity_1_10", 0),
                    "duration": s.get("duration", ""),
                    "new": s.get("is_new", False),
                })

            insights.pain_level = data.get("pain_level_0_10", -1) or -1
            insights.self_reported_vitals = data.get("self_reported_vitals", {})

            # Lifestyle
            sleep = data.get("sleep_quality_description")
            if sleep:
                insights.sleep_quality = 0.5   # placeholder; refine with another prompt
            insights.appetite_change = data.get("appetite")
            insights.activity_level = data.get("activity_level")

            # Social
            insights.caregiver_mentioned = data.get("mentioned_family_or_caregiver", False)
            insights.appointment_awareness = data.get("appointment_awareness", False)
            insights.patient_questions = data.get("patient_questions", [])

            insights.llm_content_summary = data.get("summary", "")
            insights.llm_health_concerns = data.get("health_concerns", [])

        except Exception as e:
            logger.error(f"Content analysis parsing failed: {e}")
            insights.llm_content_summary = raw  # preserve raw output

        return insights

    def analyze_emotion(self, audio: np.ndarray, sr: int) -> EmotionalProfile:
        """Analyze emotional state from patient audio."""
        raw = self.infer(audio, sr, PROMPT_TEMPLATES["emotion_analysis"])
        profile = EmotionalProfile()

        try:
            data = self._extract_json(raw)

            profile.primary_emotion = data.get("primary_emotion", "neutral")
            profile.emotion_confidence = data.get("emotion_confidence", 0.0)
            profile.secondary_emotion = data.get("secondary_emotion")
            profile.valence = data.get("valence", 0.5)
            profile.arousal = data.get("arousal", 0.5)
            profile.depression_indicators = data.get("depression_indicators", 0.0)
            profile.anxiety_indicators = data.get("anxiety_indicators", 0.0)
            profile.confusion_indicators = data.get("confusion_indicators", 0.0)
            profile.distress_level = data.get("distress_level", 0.0)
            profile.expressed_feelings = data.get("expressed_feelings", [])
            profile.llm_emotion_summary = data.get("summary", "")

        except Exception as e:
            logger.error(f"Emotion analysis parsing failed: {e}")
            profile.llm_emotion_summary = raw

        return profile

    def generate_followup(
        self,
        audio: np.ndarray,
        sr: int,
        patient_profile: Dict[str, Any],
        analysis_context: str,
    ) -> str:
        """Generate an empathetic follow-up response for the patient."""
        prompt = PROMPT_TEMPLATES["followup_generation"].format(
            name=patient_profile.get("name", "there"),
            age=patient_profile.get("age", ""),
            conditions=", ".join(patient_profile.get("conditions", [])),
            language=patient_profile.get("language", "English"),
            patient_response="<from audio>",
            analysis_context=analysis_context,
        )
        return self.infer(audio, sr, prompt)

    def generate_clinician_summary(
        self,
        patient_profile: Dict[str, Any],
        biomarkers: VocalBiomarkers,
        content: ContentInsights,
        emotions: EmotionalProfile,
    ) -> str:
        """Generate clinical note for the attending physician."""
        prompt = PROMPT_TEMPLATES["clinician_summary"].format(
            name=patient_profile.get("name", "Patient"),
            age=patient_profile.get("age", ""),
            conditions=", ".join(patient_profile.get("conditions", [])),
            date=datetime.now().strftime("%Y-%m-%d"),
            biomarkers=json.dumps(biomarkers.to_dict(), indent=2),
            content=json.dumps(content.to_dict(), indent=2),
            emotions=json.dumps(emotions.to_dict(), indent=2),
        )
        # Text-only inference (no audio needed for summary)
        if self.is_mock_mode():
            return self._mock_infer(prompt)

        try:
            inputs = self.processor(text=prompt, return_tensors="pt")
            inputs = {k: v.to(self.model.device) if hasattr(v, 'to') else v
                      for k, v in inputs.items()}
            with torch.no_grad():
                output_ids = self.model.generate(
                    **inputs,
                    max_new_tokens=self.config.max_new_tokens,
                    temperature=0.2,
                )
            input_len = inputs["input_ids"].shape[-1]
            return self.processor.decode(output_ids[0][input_len:], skip_special_tokens=True).strip()
        except Exception:
            return self._mock_infer(prompt)

    def generate_caregiver_summary(
        self,
        patient_profile: Dict[str, Any],
        content: ContentInsights,
        emotions: EmotionalProfile,
    ) -> str:
        """Generate plain-language summary for family caregivers."""
        prompt = PROMPT_TEMPLATES["caregiver_summary"].format(
            name=patient_profile.get("name", "your family member"),
            language=patient_profile.get("caregiver_language", "English"),
            medication_status=(
                "Took all medications" if content.medication_adherence_score == 1.0
                else f"Missed {content.missed_doses_reported} dose(s)"
                if content.missed_doses_reported > 0
                else "Medication not discussed"
            ),
            emotional_state=emotions.llm_emotion_summary or emotions.primary_emotion,
            concerns=", ".join(content.llm_health_concerns) if content.llm_health_concerns else "No major concerns",
            appointments="Aware of upcoming appointment" if content.appointment_awareness else "Did not mention appointments",
        )
        if self.is_mock_mode():
            return self._mock_infer(prompt)
        try:
            inputs = self.processor(text=prompt, return_tensors="pt")
            inputs = {k: v.to(self.model.device) if hasattr(v, 'to') else v
                      for k, v in inputs.items()}
            with torch.no_grad():
                output_ids = self.model.generate(**inputs, max_new_tokens=256, temperature=0.3)
            input_len = inputs["input_ids"].shape[-1]
            return self.processor.decode(output_ids[0][input_len:], skip_special_tokens=True).strip()
        except Exception:
            return self._mock_infer(prompt)

    # ── Utility ─────────────────────────────────

    @staticmethod
    def _extract_json(text: str) -> Dict[str, Any]:
        """Robustly extract JSON from model output that may contain extra text."""
        # Try direct parse
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try to find JSON block within the text
        # Look for ```json ... ``` blocks first
        import re
        json_block = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if json_block:
            try:
                return json.loads(json_block.group(1))
            except json.JSONDecodeError:
                pass

        # Find first { to last }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass

        logger.warning("Could not parse JSON from model output. Returning raw text in wrapper.")
        return {"raw_response": text, "summary": text[:200]}


# ═══════════════════════════════════════════════
# 6.  HEALTH RISK ASSESSOR & ALERT GENERATOR
# ═══════════════════════════════════════════════

class HealthRiskAssessor:
    """
    Evaluates vocal biomarkers, content, and emotional profile against
    clinical thresholds and longitudinal baselines to generate health alerts.
    """

    def __init__(self, config: Optional[EngineConfig] = None):
        self.config = config or EngineConfig()

    def assess(
        self,
        biomarkers: VocalBiomarkers,
        content: ContentInsights,
        emotions: EmotionalProfile,
        patient_baseline: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[HealthAlert], float]:
        """
        Run full risk assessment.

        Returns
        -------
        (alerts, overall_risk_score)
        """
        alerts: List[HealthAlert] = []
        risk_scores: List[float] = []

        # ── Vocal biomarker alerts ──────────────
        va, vs = self._assess_vocal(biomarkers, patient_baseline)
        alerts.extend(va)
        risk_scores.extend(vs)

        # ── Content-based alerts ────────────────
        ca, cs = self._assess_content(content)
        alerts.extend(ca)
        risk_scores.extend(cs)

        # ── Emotional alerts ────────────────────
        ea, es = self._assess_emotional(emotions)
        alerts.extend(ea)
        risk_scores.extend(es)

        # Overall risk
        overall = float(np.mean(risk_scores)) if risk_scores else 0.0
        overall = min(max(overall, 0.0), 1.0)

        # Sort alerts by severity
        severity_order = {
            AlertSeverity.CRITICAL: 0,
            AlertSeverity.HIGH: 1,
            AlertSeverity.MEDIUM: 2,
            AlertSeverity.LOW: 3,
            AlertSeverity.INFO: 4,
        }
        alerts.sort(key=lambda a: severity_order.get(a.severity, 5))

        return alerts, overall

    def _assess_vocal(
        self,
        bio: VocalBiomarkers,
        baseline: Optional[Dict[str, Any]],
    ) -> Tuple[List[HealthAlert], List[float]]:
        alerts = []
        scores = []
        cfg = self.config

        # Jitter — neurological / laryngeal
        if bio.jitter_local_pct > cfg.jitter_warn_pct:
            sev = AlertSeverity.HIGH if bio.jitter_local_pct > cfg.jitter_warn_pct * 1.5 else AlertSeverity.MEDIUM
            alerts.append(HealthAlert(
                severity=sev,
                domain=HealthDomain.NEUROLOGICAL,
                title="Elevated voice jitter detected",
                description=f"Jitter at {bio.jitter_local_pct:.2f}% (threshold: {cfg.jitter_warn_pct}%). "
                            f"May indicate laryngeal tension or early neurological changes.",
                evidence=[f"jitter_local_pct={bio.jitter_local_pct:.2f}%"],
                recommended_action="Monitor trend; if persistent over 3+ days, flag for clinical voice assessment.",
                notify_clinician=sev == AlertSeverity.HIGH,
                patient_message="I noticed some changes in your voice today. This is completely normal sometimes, but I'll keep an ear on it.",
            ))
            scores.append(0.6 if sev == AlertSeverity.HIGH else 0.4)

        # Shimmer — respiratory
        if bio.shimmer_local_pct > cfg.shimmer_warn_pct:
            alerts.append(HealthAlert(
                severity=AlertSeverity.MEDIUM,
                domain=HealthDomain.RESPIRATORY,
                title="Elevated voice shimmer",
                description=f"Shimmer at {bio.shimmer_local_pct:.2f}% (threshold: {cfg.shimmer_warn_pct}%). "
                            f"May indicate breathiness or respiratory effort.",
                evidence=[f"shimmer_local_pct={bio.shimmer_local_pct:.2f}%"],
                recommended_action="Check if patient reports shortness of breath. Compare with respiratory baseline.",
            ))
            scores.append(0.4)

        # HNR — overall voice quality
        if 0 < bio.hnr_db < cfg.hnr_warn_db:
            alerts.append(HealthAlert(
                severity=AlertSeverity.LOW,
                domain=HealthDomain.RESPIRATORY,
                title="Low harmonics-to-noise ratio",
                description=f"HNR at {bio.hnr_db:.1f} dB (healthy > {cfg.hnr_warn_db} dB). Voice sounds breathy/hoarse.",
                evidence=[f"hnr_db={bio.hnr_db:.1f}"],
                recommended_action="May indicate upper respiratory issue or vocal fatigue.",
            ))
            scores.append(0.3)

        # Speech rate — cognitive / motor
        if 0 < bio.speech_rate_wpm < cfg.speech_rate_low_wpm:
            alerts.append(HealthAlert(
                severity=AlertSeverity.MEDIUM,
                domain=HealthDomain.COGNITIVE,
                title="Unusually slow speech rate",
                description=f"Speech rate at {bio.speech_rate_wpm:.0f} wpm (expected > {cfg.speech_rate_low_wpm}). "
                            f"May indicate cognitive slowdown, medication side-effects, or fatigue.",
                evidence=[f"speech_rate_wpm={bio.speech_rate_wpm:.0f}"],
                recommended_action="Compare with patient baseline. Ask about sleep, medication changes.",
                notify_caregiver=True,
            ))
            scores.append(0.5)

        # Pause ratio — cognitive
        if bio.pause_ratio > cfg.pause_ratio_warn:
            alerts.append(HealthAlert(
                severity=AlertSeverity.MEDIUM,
                domain=HealthDomain.COGNITIVE,
                title="High pause ratio in speech",
                description=f"Patient was silent {bio.pause_ratio*100:.0f}% of the call "
                            f"(threshold: {cfg.pause_ratio_warn*100:.0f}%). "
                            f"Longest pause: {bio.longest_pause_s:.1f}s.",
                evidence=[f"pause_ratio={bio.pause_ratio:.2f}", f"longest_pause={bio.longest_pause_s:.1f}s"],
                recommended_action="May indicate word-finding difficulty, confusion, or low engagement.",
            ))
            scores.append(0.4)

        # Energy trend — fatigue
        if bio.energy_trend < -0.05:   # negative slope
            alerts.append(HealthAlert(
                severity=AlertSeverity.LOW,
                domain=HealthDomain.SYMPTOMS,
                title="Declining voice energy during call",
                description="Voice energy decreased over the call duration, suggesting fatigue.",
                evidence=[f"energy_trend={bio.energy_trend:.4f}"],
                recommended_action="Ask about sleep quality and energy levels.",
                patient_message="You sound a bit tired today. Make sure you're getting enough rest!",
            ))
            scores.append(0.2)

        # Baseline comparison (longitudinal)
        if baseline:
            self._compare_to_baseline(bio, baseline, alerts, scores)

        return alerts, scores

    def _compare_to_baseline(
        self,
        bio: VocalBiomarkers,
        baseline: Dict[str, Any],
        alerts: List[HealthAlert],
        scores: List[float],
    ) -> None:
        """Compare current session against patient's rolling baseline."""
        threshold = self.config.significant_change_pct / 100

        comparisons = [
            ("pitch_mean_hz", "Pitch", HealthDomain.NEUROLOGICAL),
            ("jitter_local_pct", "Jitter", HealthDomain.NEUROLOGICAL),
            ("shimmer_local_pct", "Shimmer", HealthDomain.RESPIRATORY),
            ("speech_rate_wpm", "Speech rate", HealthDomain.COGNITIVE),
            ("hnr_db", "Voice quality (HNR)", HealthDomain.RESPIRATORY),
        ]

        for attr, label, domain in comparisons:
            current = getattr(bio, attr, 0)
            base_val = baseline.get(attr, 0)
            if base_val > 0 and current > 0:
                pct_change = abs(current - base_val) / base_val
                if pct_change > threshold:
                    direction = "increased" if current > base_val else "decreased"
                    alerts.append(HealthAlert(
                        severity=AlertSeverity.MEDIUM,
                        domain=domain,
                        title=f"{label} significantly {direction} from baseline",
                        description=f"{label} changed by {pct_change*100:.1f}% "
                                    f"(current: {current:.2f}, baseline: {base_val:.2f})",
                        evidence=[f"{attr}_change={pct_change*100:.1f}%"],
                        recommended_action=f"Review {label.lower()} trend over past {self.config.trend_window_days} days.",
                    ))
                    scores.append(0.35)

    def _assess_content(self, content: ContentInsights) -> Tuple[List[HealthAlert], List[float]]:
        alerts = []
        scores = []

        # Missed medications
        if content.missed_doses_reported > 0:
            sev = AlertSeverity.HIGH if content.missed_doses_reported >= 2 else AlertSeverity.MEDIUM
            alerts.append(HealthAlert(
                severity=sev,
                domain=HealthDomain.MEDICATION,
                title=f"Missed {content.missed_doses_reported} medication dose(s)",
                description=f"Patient reported missing {content.missed_doses_reported} dose(s). "
                            f"Medications discussed: {', '.join(content.medication_mentioned)}.",
                evidence=[f"missed_doses={content.missed_doses_reported}"],
                recommended_action="Reinforce adherence. Consider medication reminder setup.",
                notify_caregiver=True,
                patient_message="I understand it can be hard to remember all your medications. "
                               "Would you like me to set up reminders for you?",
            ))
            scores.append(0.6 if sev == AlertSeverity.HIGH else 0.4)

        # Medication adherence = 0
        if content.medication_adherence_score == 0.0:
            alerts.append(HealthAlert(
                severity=AlertSeverity.HIGH,
                domain=HealthDomain.MEDICATION,
                title="No medications taken today",
                description="Patient indicated they have not taken any medications today.",
                recommended_action="Urgent: Contact patient or caregiver to ensure medications are taken.",
                notify_caregiver=True,
                notify_clinician=True,
            ))
            scores.append(0.8)

        # New or severe symptoms
        for s in content.symptoms_reported:
            severity = s.get("severity", 0)
            if s.get("new", False):
                sev = AlertSeverity.HIGH if severity >= 7 else AlertSeverity.MEDIUM
                alerts.append(HealthAlert(
                    severity=sev,
                    domain=HealthDomain.SYMPTOMS,
                    title=f"New symptom reported: {s.get('symptom', 'unknown')}",
                    description=f"Severity: {severity}/10, Duration: {s.get('duration', 'unknown')}",
                    evidence=[json.dumps(s)],
                    recommended_action="New symptom requires clinical evaluation if persistent.",
                    notify_clinician=severity >= 7,
                ))
                scores.append(severity / 10 * 0.8)
            elif severity >= 7:
                alerts.append(HealthAlert(
                    severity=AlertSeverity.HIGH,
                    domain=HealthDomain.SYMPTOMS,
                    title=f"Severe symptom: {s.get('symptom', 'unknown')} ({severity}/10)",
                    description=f"Duration: {s.get('duration', 'unknown')}",
                    recommended_action="High severity warrants clinical attention.",
                    notify_clinician=True,
                    notify_caregiver=True,
                ))
                scores.append(0.7)

        # High pain
        if content.pain_level >= 7:
            alerts.append(HealthAlert(
                severity=AlertSeverity.HIGH,
                domain=HealthDomain.SYMPTOMS,
                title=f"High pain level reported: {content.pain_level}/10",
                recommended_action="Assess pain management plan. Consider clinical follow-up.",
                notify_clinician=True,
            ))
            scores.append(0.7)

        # Social isolation
        if content.social_isolation_risk > 0.6:
            alerts.append(HealthAlert(
                severity=AlertSeverity.MEDIUM,
                domain=HealthDomain.SOCIAL,
                title="Social isolation risk detected",
                description="Patient shows signs of reduced social engagement.",
                recommended_action="Consider community program referral or caregiver check-in.",
                notify_caregiver=True,
            ))
            scores.append(0.4)

        # Appointment awareness
        if not content.appointment_awareness:
            alerts.append(HealthAlert(
                severity=AlertSeverity.LOW,
                domain=HealthDomain.APPOINTMENT,
                title="Patient may not be aware of upcoming appointments",
                recommended_action="Send appointment reminder.",
                patient_message="Just a reminder — you have an upcoming appointment. Would you like me to give you the details?",
            ))
            scores.append(0.2)

        # Side effects
        if content.side_effects_mentioned:
            alerts.append(HealthAlert(
                severity=AlertSeverity.MEDIUM,
                domain=HealthDomain.MEDICATION,
                title=f"Medication side effects reported: {', '.join(content.side_effects_mentioned)}",
                recommended_action="Review with prescribing physician.",
                notify_clinician=True,
            ))
            scores.append(0.5)

        return alerts, scores

    def _assess_emotional(self, emo: EmotionalProfile) -> Tuple[List[HealthAlert], List[float]]:
        alerts = []
        scores = []
        cfg = self.config

        # Depression
        if emo.depression_indicators > cfg.depression_valence_floor * 2:   # > 0.5
            sev = AlertSeverity.HIGH if emo.depression_indicators > 0.7 else AlertSeverity.MEDIUM
            alerts.append(HealthAlert(
                severity=sev,
                domain=HealthDomain.MENTAL_HEALTH,
                title="Depression indicators detected",
                description=f"Depression score: {emo.depression_indicators:.2f}. "
                            f"Valence: {emo.valence:.2f}. "
                            f"Primary emotion: {emo.primary_emotion}.",
                evidence=[f"depression={emo.depression_indicators:.2f}", f"valence={emo.valence:.2f}"],
                recommended_action="Monitor over next 3 days. If persistent, refer for mental health screening.",
                notify_caregiver=True,
                patient_message="I can hear you might be going through a tough time. Remember, you're not alone. "
                               "Would you like me to connect you with someone to talk to?",
            ))
            scores.append(emo.depression_indicators * 0.8)

        # Low valence
        if emo.valence < cfg.depression_valence_floor:
            alerts.append(HealthAlert(
                severity=AlertSeverity.MEDIUM,
                domain=HealthDomain.MENTAL_HEALTH,
                title="Very low emotional valence",
                description=f"Patient's emotional tone is significantly negative (valence: {emo.valence:.2f}).",
                recommended_action="Check in with additional supportive questions.",
            ))
            scores.append(0.5)

        # Anxiety
        if emo.anxiety_indicators > 0.6:
            alerts.append(HealthAlert(
                severity=AlertSeverity.MEDIUM,
                domain=HealthDomain.MENTAL_HEALTH,
                title="Anxiety indicators detected",
                description=f"Anxiety score: {emo.anxiety_indicators:.2f}. "
                            f"Arousal: {emo.arousal:.2f}.",
                recommended_action="Explore sources of anxiety. Consider relaxation guidance.",
                patient_message="It sounds like you might be feeling a bit worried. "
                               "Take a deep breath. Is there something specific on your mind?",
            ))
            scores.append(emo.anxiety_indicators * 0.6)

        # Confusion
        if emo.confusion_indicators > 0.5:
            sev = AlertSeverity.HIGH if emo.confusion_indicators > 0.7 else AlertSeverity.MEDIUM
            alerts.append(HealthAlert(
                severity=sev,
                domain=HealthDomain.COGNITIVE,
                title="Confusion indicators detected",
                description=f"Confusion score: {emo.confusion_indicators:.2f}. "
                            f"Patient may be disoriented or having difficulty with comprehension.",
                recommended_action="Urgent if acute: rule out delirium, medication interaction, or hypoglycemia.",
                notify_caregiver=True,
                notify_clinician=emo.confusion_indicators > 0.7,
            ))
            scores.append(emo.confusion_indicators * 0.8)

        # Distress
        if emo.distress_level > cfg.distress_score_ceil:
            alerts.append(HealthAlert(
                severity=AlertSeverity.HIGH,
                domain=HealthDomain.MENTAL_HEALTH,
                title="High distress level detected",
                description=f"Distress score: {emo.distress_level:.2f}. Patient sounds significantly distressed.",
                recommended_action="Immediate caregiver notification. Assess for acute issues.",
                notify_caregiver=True,
                notify_clinician=True,
                patient_message="I can tell you're really not feeling well. Let me get some help for you right away.",
            ))
            scores.append(0.8)

        return alerts, scores


# ═══════════════════════════════════════════════
# 7.  HYBRID EMOTION ANALYZER
# ═══════════════════════════════════════════════

class HybridEmotionAnalyzer:
    """
    Combines acoustic features (from VocalBiomarkerExtractor) with
    MERaLiON's semantic emotion understanding for a richer emotional profile.
    """

    def __init__(self, config: Optional[EngineConfig] = None):
        self.config = config or EngineConfig()

    def merge(
        self,
        acoustic_bio: VocalBiomarkers,
        llm_emotion: EmotionalProfile,
    ) -> EmotionalProfile:
        """
        Merge acoustic signals into the LLM-derived emotional profile.

        Acoustic cues can override / boost LLM scores when there's strong
        signal (e.g., monotone pitch + LLM says "fine" → flag depression).
        """
        merged = EmotionalProfile(**{k: v for k, v in llm_emotion.__dict__.items()})

        # ── Acoustic depression cues ─────────────
        # Monotone (low pitch variability) + low energy = depression signal
        if acoustic_bio.pitch_std_hz < 15 and acoustic_bio.pitch_range_hz < 40:
            acoustic_depression = 0.6
            merged.depression_indicators = max(merged.depression_indicators, acoustic_depression)
            if "monotone voice" not in merged.expressed_feelings:
                merged.expressed_feelings.append("monotone voice detected")

        # Low energy
        if acoustic_bio.energy_mean_db < -30:
            merged.depression_indicators = max(merged.depression_indicators,
                                                merged.depression_indicators + 0.1)

        # ── Acoustic anxiety cues ────────────────
        # High pitch + fast speech rate = anxiety signal
        if (acoustic_bio.pitch_mean_hz > 200 and
                acoustic_bio.speech_rate_wpm > self.config.speech_rate_high_wpm):
            acoustic_anxiety = 0.5
            merged.anxiety_indicators = max(merged.anxiety_indicators, acoustic_anxiety)
            merged.arousal = max(merged.arousal, 0.7)

        # ── Acoustic confusion cues ──────────────
        # Long pauses + low speech rate = possible confusion
        if (acoustic_bio.pause_ratio > 0.5 and
                acoustic_bio.speech_rate_wpm < self.config.speech_rate_low_wpm * 0.8):
            acoustic_confusion = 0.5
            merged.confusion_indicators = max(merged.confusion_indicators, acoustic_confusion)

        # ── Acoustic distress cues ───────────────
        # Very high energy variability + high pitch = distress
        if acoustic_bio.energy_std_db > 15 and acoustic_bio.pitch_mean_hz > 250:
            merged.distress_level = max(merged.distress_level, 0.6)

        return merged


# ═══════════════════════════════════════════════
# 8.  PROACTIVE CALL SESSION — ORCHESTRATOR
# ═══════════════════════════════════════════════

class ProactiveCallSession:
    """
    Orchestrates a complete daily proactive health check-in call.

    Flow
    ────
    1.  Initiate → personalized greeting in patient's language
    2.  Listen  → patient responds (audio captured)
    3.  Analyze → MERaLiON content + vocal biomarkers + emotion
    4.  Respond → empathetic follow-up (may loop for multi-turn)
    5.  Close   → summarize, generate alerts, notify stakeholders
    """

    def __init__(
        self,
        engine: MERaLiONEngine,
        config: Optional[EngineConfig] = None,
    ):
        self.engine = engine
        self.config = config or EngineConfig()
        self.biomarker_extractor = VocalBiomarkerExtractor(self.config)
        self.risk_assessor = HealthRiskAssessor(self.config)
        self.emotion_merger = HybridEmotionAnalyzer(self.config)
        self.result: Optional[CallAnalysisResult] = None

    def run_full_analysis(
        self,
        audio: np.ndarray,
        sr: int,
        patient_profile: Dict[str, Any],
        patient_baseline: Optional[Dict[str, Any]] = None,
    ) -> CallAnalysisResult:
        """
        Run the complete analysis pipeline on a patient's audio response.

        Parameters
        ----------
        audio : np.ndarray
            Patient's audio response (mono, any sample rate).
        sr : int
            Sample rate.
        patient_profile : dict
            Must contain: name, age, conditions, language.
            Optional: patient_id, caregiver_language, medications.
        patient_baseline : dict, optional
            Rolling average vocal biomarkers from previous sessions.

        Returns
        -------
        CallAnalysisResult
            Complete analysis with biomarkers, content, emotions, alerts, summaries.

        Example
        -------
        >>> session = ProactiveCallSession(engine)
        >>> result = session.run_full_analysis(
        ...     audio=audio_array,
        ...     sr=16000,
        ...     patient_profile={
        ...         "patient_id": "TAN_001",
        ...         "name": "Mr. Tan",
        ...         "age": 65,
        ...         "conditions": ["Type 2 Diabetes", "Hypertension", "Osteoarthritis"],
        ...         "language": "en",
        ...         "caregiver_language": "en",
        ...         "medications": ["Metformin", "Amlodipine", "Paracetamol"],
        ...     },
        ... )
        >>> print(result.overall_risk_score)
        >>> print(result.alerts)
        """
        t_start = time.time()

        result = CallAnalysisResult(
            patient_id=patient_profile.get("patient_id", "unknown"),
        )

        logger.info(f"Starting analysis for patient: {patient_profile.get('name', 'unknown')}")

        # Ensure model is loaded
        self.engine.load_model()

        # Resample to target
        if sr != self.config.target_sr and HAS_LIBROSA:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=self.config.target_sr)
            sr = self.config.target_sr

        # ── Step 1: Vocal Biomarker Extraction (acoustic) ──
        logger.info("Extracting vocal biomarkers...")
        result.vocal_biomarkers = self.biomarker_extractor.extract(audio, sr)
        logger.info(f"  Pitch: {result.vocal_biomarkers.pitch_mean_hz:.1f} Hz, "
                     f"Jitter: {result.vocal_biomarkers.jitter_local_pct:.2f}%, "
                     f"Speech rate: {result.vocal_biomarkers.speech_rate_wpm:.0f} wpm")

        # ── Step 2: Content Analysis (MERaLiON) ────────────
        logger.info("Analyzing content via MERaLiON...")
        result.content_insights = self.engine.analyze_content(audio, sr)
        logger.info(f"  Language: {result.content_insights.detected_language}, "
                     f"Medications adherence: {result.content_insights.medication_adherence_score}, "
                     f"Symptoms: {len(result.content_insights.symptoms_reported)}")

        # ── Step 3: Emotional Analysis (MERaLiON) ──────────
        logger.info("Analyzing emotional tone via MERaLiON...")
        llm_emotions = self.engine.analyze_emotion(audio, sr)

        # ── Step 4: Hybrid Emotion Merging ─────────────────
        logger.info("Merging acoustic + semantic emotion signals...")
        result.emotional_profile = self.emotion_merger.merge(
            result.vocal_biomarkers, llm_emotions
        )
        logger.info(f"  Emotion: {result.emotional_profile.primary_emotion} "
                     f"(val={result.emotional_profile.valence:.2f}, "
                     f"dep={result.emotional_profile.depression_indicators:.2f})")

        # ── Step 5: Risk Assessment & Alerts ───────────────
        logger.info("Assessing health risks...")
        result.alerts, result.overall_risk_score = self.risk_assessor.assess(
            result.vocal_biomarkers,
            result.content_insights,
            result.emotional_profile,
            patient_baseline,
        )
        logger.info(f"  Overall risk: {result.overall_risk_score:.2f}, "
                     f"Alerts: {len(result.alerts)}")

        # ── Step 6: Generate Summaries ─────────────────────
        logger.info("Generating clinician summary...")
        result.llm_clinician_summary = self.engine.generate_clinician_summary(
            patient_profile,
            result.vocal_biomarkers,
            result.content_insights,
            result.emotional_profile,
        )

        logger.info("Generating caregiver summary...")
        result.llm_caregiver_summary = self.engine.generate_caregiver_summary(
            patient_profile,
            result.content_insights,
            result.emotional_profile,
        )

        # Finalize
        result.call_duration_s = time.time() - t_start
        self.result = result

        logger.info(f"Analysis complete in {result.call_duration_s:.1f}s")
        return result

    def get_greeting(self, patient_profile: Dict[str, Any]) -> str:
        """Generate a personalized greeting in the patient's preferred language."""
        lang = patient_profile.get("language", "en")
        template_key = f"greeting_{lang}"
        template = PROMPT_TEMPLATES.get(template_key, PROMPT_TEMPLATES["greeting_en"])
        return template.format(name=patient_profile.get("name", ""))

    def generate_followup_response(
        self,
        audio: np.ndarray,
        sr: int,
        patient_profile: Dict[str, Any],
    ) -> str:
        """Generate context-aware follow-up question based on analysis so far."""
        context = ""
        if self.result:
            context = json.dumps({
                "content_summary": self.result.content_insights.llm_content_summary,
                "emotion": self.result.emotional_profile.primary_emotion,
                "concerns": self.result.content_insights.llm_health_concerns,
                "risk_score": self.result.overall_risk_score,
            }, ensure_ascii=False)

        return self.engine.generate_followup(audio, sr, patient_profile, context)


# ═══════════════════════════════════════════════
# 9.  LONGITUDINAL TRACKER (TRENDING)
# ═══════════════════════════════════════════════

class LongitudinalTracker:
    """
    Tracks vocal biomarkers and health metrics over time to detect
    gradual changes that might indicate disease progression.

    In production, this would back onto a database. For the hackathon,
    we use an in-memory store with simple statistical trending.
    """

    def __init__(self, config: Optional[EngineConfig] = None):
        self.config = config or EngineConfig()
        self._history: Dict[str, List[Dict[str, Any]]] = {}  # patient_id → sessions

    def record_session(self, result: CallAnalysisResult) -> None:
        """Store a completed session for longitudinal analysis."""
        pid = result.patient_id
        if pid not in self._history:
            self._history[pid] = []

        self._history[pid].append({
            "timestamp": result.call_timestamp,
            "biomarkers": result.vocal_biomarkers.to_dict(),
            "risk_score": result.overall_risk_score,
            "medication_adherence": result.content_insights.medication_adherence_score,
            "depression": result.emotional_profile.depression_indicators,
            "valence": result.emotional_profile.valence,
            "num_alerts": len(result.alerts),
        })

        # Keep only last N days
        cutoff = datetime.now() - timedelta(days=self.config.trend_window_days * 2)
        self._history[pid] = [
            s for s in self._history[pid]
            if datetime.fromisoformat(s["timestamp"]) > cutoff
        ]

    def get_baseline(self, patient_id: str) -> Optional[Dict[str, Any]]:
        """
        Compute rolling baseline from recent sessions.
        Returns averaged biomarker values for comparison.
        """
        sessions = self._history.get(patient_id, [])
        if len(sessions) < 3:
            return None

        # Use last N sessions for baseline
        window = sessions[-min(len(sessions), self.config.trend_window_days):]
        bio_keys = [
            "pitch_mean_hz", "pitch_std_hz", "jitter_local_pct",
            "shimmer_local_pct", "hnr_db", "speech_rate_wpm",
            "pause_ratio", "energy_mean_db",
        ]

        baseline = {}
        for key in bio_keys:
            values = [s["biomarkers"].get(key, 0) for s in window if s["biomarkers"].get(key, 0) > 0]
            if values:
                baseline[key] = float(np.mean(values))

        return baseline

    def get_trend(self, patient_id: str, metric: str = "risk_score") -> str:
        """Determine if a metric is improving, stable, or declining."""
        sessions = self._history.get(patient_id, [])
        if len(sessions) < 5:
            return "insufficient_data"

        recent = [s.get(metric, 0) for s in sessions[-7:]]
        older = [s.get(metric, 0) for s in sessions[-14:-7]]

        if not older or not recent:
            return "insufficient_data"

        recent_avg = np.mean(recent)
        older_avg = np.mean(older)

        if older_avg == 0:
            return "stable"

        change = (recent_avg - older_avg) / abs(older_avg)

        if change > self.config.significant_change_pct / 100:
            return "declining" if metric in ["risk_score", "depression"] else "improving"
        elif change < -self.config.significant_change_pct / 100:
            return "improving" if metric in ["risk_score", "depression"] else "declining"
        return "stable"

    def get_adherence_rate(self, patient_id: str, days: int = 7) -> float:
        """Calculate medication adherence rate over recent days."""
        sessions = self._history.get(patient_id, [])
        cutoff = datetime.now() - timedelta(days=days)
        recent = [
            s for s in sessions
            if datetime.fromisoformat(s["timestamp"]) > cutoff
            and s.get("medication_adherence", -1) >= 0
        ]
        if not recent:
            return -1.0
        return float(np.mean([s["medication_adherence"] for s in recent]))


# ═══════════════════════════════════════════════
# 10. CONVENIENCE: AUDIO I/O HELPERS
# ═══════════════════════════════════════════════

def load_audio(path: Union[str, Path], target_sr: int = 16_000) -> Tuple[np.ndarray, int]:
    """Load audio file and resample to target rate."""
    if not HAS_LIBROSA:
        raise ImportError("librosa is required for audio loading.")
    audio, sr = librosa.load(str(path), sr=target_sr, mono=True)
    return audio, sr


def audio_from_bytes(audio_bytes: bytes, target_sr: int = 16_000) -> Tuple[np.ndarray, int]:
    """Load audio from bytes (e.g., from a web API or phone stream)."""
    if not HAS_LIBROSA:
        raise ImportError("librosa is required for audio loading.")
    import soundfile as sf
    audio, sr = sf.read(io.BytesIO(audio_bytes))
    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)  # to mono
    if sr != target_sr:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sr)
    return audio.astype(np.float32), target_sr


# ═══════════════════════════════════════════════
# 11. MAIN — DEMO / HACKATHON RUNNER
# ═══════════════════════════════════════════════

def main():
    """
    Demo: Run the full pipeline on a sample audio file.
    Usage: python meralion_engine.py [--audio path/to/audio.wav]
    """
    import argparse

    parser = argparse.ArgumentParser(description="Vocal Biomarker Caretaker — MERaLiON Engine")
    parser.add_argument("--audio", type=str, default=None, help="Path to patient audio file (.wav/.mp3/.flac)")
    parser.add_argument("--mock", action="store_true", help="Force mock mode (no GPU/model needed)")
    parser.add_argument("--patient-name", type=str, default="Mr. Tan")
    parser.add_argument("--patient-age", type=int, default=65)
    parser.add_argument("--language", type=str, default="en", choices=["en", "zh", "ms", "ta"])
    args = parser.parse_args()

    # ── Patient Profile (Mr. Tan!) ──────────────
    patient_profile = {
        "patient_id": "TAN_001",
        "name": args.patient_name,
        "age": args.patient_age,
        "conditions": ["Type 2 Diabetes", "Hypertension", "Osteoarthritis"],
        "medications": ["Metformin 500mg", "Amlodipine 5mg", "Paracetamol PRN"],
        "language": args.language,
        "caregiver_language": "en",
    }

    # ── Initialize Engine ───────────────────────
    config = EngineConfig()
    engine = MERaLiONEngine(config)

    if args.mock:
        logger.info("Running in MOCK mode.")
    else:
        engine.load_model()

    session = ProactiveCallSession(engine, config)
    tracker = LongitudinalTracker(config)

    # ── Load Audio ──────────────────────────────
    if args.audio:
        audio, sr = load_audio(args.audio, config.target_sr)
        logger.info(f"Loaded audio: {args.audio} ({len(audio)/sr:.1f}s, {sr} Hz)")
    else:
        # Generate synthetic audio for demo
        logger.info("No audio file provided — generating synthetic demo audio.")
        sr = config.target_sr
        duration = 5.0
        t = np.linspace(0, duration, int(sr * duration))
        audio = (0.3 * np.sin(2 * np.pi * 150 * t) +
                 0.1 * np.random.randn(len(t))).astype(np.float32)

    # ── Greeting ────────────────────────────────
    greeting = session.get_greeting(patient_profile)
    print("\n" + "═" * 60)
    print("  🏥  VOCAL BIOMARKER CARETAKER — Daily Check-In")
    print("═" * 60)
    print(f"\n🤖 Assistant: {greeting}\n")

    # ── Run Full Analysis ───────────────────────
    baseline = tracker.get_baseline(patient_profile["patient_id"])
    result = session.run_full_analysis(audio, sr, patient_profile, baseline)

    # ── Display Results ─────────────────────────
    print("─" * 60)
    print("  📊  ANALYSIS RESULTS")
    print("─" * 60)

    print(f"\n📝 Transcript: {result.content_insights.transcript}")
    print(f"🌐 Language: {result.content_insights.detected_language}")

    print(f"\n🎤 Vocal Biomarkers:")
    bio = result.vocal_biomarkers
    print(f"   Pitch:       {bio.pitch_mean_hz:.1f} Hz (std: {bio.pitch_std_hz:.1f})")
    print(f"   Jitter:      {bio.jitter_local_pct:.2f}%")
    print(f"   Shimmer:     {bio.shimmer_local_pct:.2f}%")
    print(f"   HNR:         {bio.hnr_db:.1f} dB")
    print(f"   Speech rate: {bio.speech_rate_wpm:.0f} wpm")
    print(f"   Pause ratio: {bio.pause_ratio:.0%}")
    print(f"   Energy:      {bio.energy_mean_db:.1f} dB (trend: {bio.energy_trend:.4f})")

    print(f"\n💊 Medication:")
    print(f"   Adherence:   {result.content_insights.medication_adherence_score}")
    print(f"   Missed:      {result.content_insights.missed_doses_reported}")
    print(f"   Mentioned:   {result.content_insights.medication_mentioned}")

    print(f"\n😊 Emotional Profile:")
    emo = result.emotional_profile
    print(f"   Primary:     {emo.primary_emotion} (confidence: {emo.emotion_confidence:.0%})")
    print(f"   Valence:     {emo.valence:.2f}  |  Arousal: {emo.arousal:.2f}")
    print(f"   Depression:  {emo.depression_indicators:.2f}")
    print(f"   Anxiety:     {emo.anxiety_indicators:.2f}")
    print(f"   Confusion:   {emo.confusion_indicators:.2f}")
    print(f"   Distress:    {emo.distress_level:.2f}")

    print(f"\n⚠️  Risk Score: {result.overall_risk_score:.2f}")
    print(f"📈 Trend: {result.risk_trend}")

    if result.alerts:
        print(f"\n🚨 Alerts ({len(result.alerts)}):")
        for alert in result.alerts:
            icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢", "info": "ℹ️"}
            print(f"   {icon.get(alert.severity.value, '•')} [{alert.severity.value.upper()}] {alert.title}")
            if alert.recommended_action:
                print(f"     → {alert.recommended_action}")
            if alert.patient_message:
                print(f"     💬 \"{alert.patient_message}\"")

    print(f"\n👨‍⚕️ Clinician Summary:")
    print(f"   {result.llm_clinician_summary}")

    print(f"\n👨‍👩‍👦 Caregiver Summary:")
    print(f"   {result.llm_caregiver_summary}")

    # ── Record for trending ─────────────────────
    tracker.record_session(result)

    # ── Follow-up response ──────────────────────
    followup = session.generate_followup_response(audio, sr, patient_profile)
    print(f"\n🤖 Follow-up: {followup}")

    print("\n" + "═" * 60)
    print(f"  ✅  Analysis complete in {result.call_duration_s:.1f}s")
    print("═" * 60)

    # ── Export JSON ─────────────────────────────
    output_path = Path("call_analysis_result.json")
    output_path.write_text(result.to_json(), encoding="utf-8")
    print(f"\n📄 Full results saved to: {output_path}")

    return result


if __name__ == "__main__":
    main()