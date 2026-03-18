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
    llm_health_concerns: List[str] = 