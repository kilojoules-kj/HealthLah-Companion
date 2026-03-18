# meralion_engine.py — MERaLiON API engine (hosted, OpenAI-compatible)
import base64
import pathlib
import logging
import os

logger = logging.getLogger(__name__)

# MERaLiON hosted API (OpenAI-compatible)
MERALION_BASE_URL = "http://meralion.org:8010/v1"
MERALION_MODEL = "MERaLiON/MERaLiON-3-10B"


class MERaLiONEngine:
    """
    MERaLiON AudioLLM wrapper — uses the hosted MERaLiON API.

    The API is OpenAI-compatible, so we use the OpenAI SDK pointed at
    http://meralion.org:8010.  Audio is sent as base64 data URLs.

    Falls back to demo mode if the API is unreachable.
    """

    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("MERALION_API_KEY", "")
        self.demo_mode = False

        if not self.api_key:
            logger.warning(
                "MERALION_API_KEY not set — running in demo mode. "
                "Set MERALION_API_KEY in .env to use the real API."
            )
            self.demo_mode = True
            self.client = None
            self.model = MERALION_MODEL
            return

        try:
            from openai import OpenAI
            self.client = OpenAI(
                base_url=MERALION_BASE_URL,
                api_key=self.api_key,
            )
        except Exception as e:
            logger.warning(f"Failed to init OpenAI client: {e} — running in demo mode")
            self.demo_mode = True
            self.client = None

        self.model = MERALION_MODEL
        logger.info(f"MERaLiON engine ready (model={self.model}, demo={self.demo_mode})")

    # ── helpers ────────────────────────────────────────────────

    @staticmethod
    def _audio_to_data_url(audio_path: str) -> str:
        """Read an audio file and return a base64 data URL."""
        data = pathlib.Path(audio_path).read_bytes()
        b64 = base64.b64encode(data).decode()
        # Determine MIME from extension
        ext = pathlib.Path(audio_path).suffix.lower().lstrip(".")
        mime = {"wav": "audio/wav", "mp3": "audio/mpeg", "m4a": "audio/m4a"}.get(
            ext, "audio/wav"
        )
        return f"data:{mime};base64,{b64}"

    def _chat(self, messages: list[dict], max_tokens: int = 512) -> str:
        """Send a chat completion request and return the assistant text."""
        if self.demo_mode or self.client is None:
            raise ConnectionError("MERaLiON API not available (demo mode)")

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    # ── public API (same interface as before) ──────────────────

    def process_audio_turn(
        self,
        audio_path: str,
        system_prompt: str,
        conversation_history: list[dict],
        current_phase_instruction: str,
    ) -> dict:
        """
        Process one turn: patient audio → MERaLiON API → structured response.
        Falls back to demo response if API is unavailable.
        """
        if self.demo_mode:
            return self._demo_process_audio_turn(audio_path, conversation_history, current_phase_instruction)

        try:
            audio_url = self._audio_to_data_url(audio_path)
            text_prompt = self._build_prompt(
                system_prompt, conversation_history, current_phase_instruction
            )
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": text_prompt},
                        {
                            "type": "audio_url",
                            "audio_url": {"url": audio_url},
                        },
                    ],
                }
            ]
            raw_response = self._chat(messages, max_tokens=512)
            logger.info(f"Raw response: {raw_response[:200]}...")
            return self._parse_response(raw_response)
        except Exception as e:
            logger.warning(f"MERaLiON API call failed: {e} — using demo response")
            return self._demo_process_audio_turn(audio_path, conversation_history, current_phase_instruction)

    def transcribe_only(self, audio_path: str) -> str:
        """Simple transcription via the /audio/transcription endpoint."""
        if self.demo_mode:
            return self._demo_transcription()

        try:
            audio_url = self._audio_to_data_url(audio_path)
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Please transcribe this speech."},
                        {
                            "type": "audio_url",
                            "audio_url": {"url": audio_url},
                        },
                    ],
                }
            ]
            return self._chat(messages, max_tokens=256)
        except Exception as e:
            logger.warning(f"Transcription failed: {e} — using demo transcription")
            return self._demo_transcription()

    def process_with_instruction(self, audio_path: str, instruction: str) -> str:
        """Send audio + a single instruction to MERaLiON."""
        if self.demo_mode:
            return self._demo_risk_response(instruction)

        try:
            audio_url = self._audio_to_data_url(audio_path)
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": instruction},
                        {
                            "type": "audio_url",
                            "audio_url": {"url": audio_url},
                        },
                    ],
                }
            ]
            return self._chat(messages, max_tokens=512)
        except Exception as e:
            logger.warning(f"Instruction processing failed: {e} — using demo response")
            return self._demo_risk_response(instruction)

    # ── prompt building ────────────────────────────────────────

    def _build_prompt(
        self,
        system_prompt: str,
        conversation_history: list[dict],
        phase_instruction: str,
    ) -> str:
        """
        Build a single text prompt that accompanies the audio.
        """
        history_text = ""
        if conversation_history:
            recent = conversation_history[-6:]
            history_text = "\n\nPrevious conversation:\n"
            for turn in recent:
                role = "Kawan" if turn["role"] == "assistant" else "Patient"
                history_text += f"{role}: {turn['content']}\n"

        prompt = f"""{system_prompt}
{history_text}

CURRENT TASK:
{phase_instruction}

Listen to the patient's audio carefully and respond in this format:
[TRANSCRIPTION] what the patient said
[LANGUAGE] detected language
[MOOD] cheerful/neutral/tired/anxious/sad/confused/distressed
[ADHERENCE] taken/not_taken/partial/unclear/not_applicable
[FLAGS] health concerns (comma-separated) or "none"
[RESPONSE] your warm, short response to the patient"""

        return prompt

    # ── response parsing ───────────────────────────────────────

    def _parse_response(self, raw: str) -> dict:
        """Parse MERaLiON's structured output into a dict."""
        result = {
            "transcription": "",
            "language_detected": "",
            "response_to_patient": "",
            "health_flags": [],
            "mood_assessment": "",
            "adherence_status": "",
            "raw_output": raw,
        }

        current_section = None
        for line in raw.strip().split("\n"):
            line = line.strip()
            if not line:
                continue

            if line.startswith("[TRANSCRIPTION]"):
                current_section = "transcription"
                result["transcription"] = line.replace("[TRANSCRIPTION]", "").strip()
            elif line.startswith("[LANGUAGE]"):
                current_section = None
                result["language_detected"] = line.replace("[LANGUAGE]", "").strip()
            elif line.startswith("[MOOD]"):
                current_section = None
                result["mood_assessment"] = line.replace("[MOOD]", "").strip()
            elif line.startswith("[ADHERENCE]"):
                current_section = None
                result["adherence_status"] = line.replace("[ADHERENCE]", "").strip()
            elif line.startswith("[FLAGS]"):
                current_section = None
                flags = line.replace("[FLAGS]", "").strip()
                result["health_flags"] = [
                    f.strip()
                    for f in flags.split(",")
                    if f.strip() and f.strip().lower() != "none"
                ]
            elif line.startswith("[RESPONSE]"):
                current_section = "response"
                result["response_to_patient"] = line.replace("[RESPONSE]", "").strip()
            elif current_section == "response":
                result["response_to_patient"] += " " + line
            elif current_section == "transcription":
                result["transcription"] += " " + line

        # Fallback: if structured parsing fails, use raw as response
        if not result["response_to_patient"]:
            result["response_to_patient"] = raw.strip()
            logger.warning(
                "Structured parsing failed — using raw output as response"
            )

        return result

    # ── Demo / fallback methods ────────────────────────────────

    _demo_turn = 0

    def _demo_transcription(self) -> str:
        """Return a simulated transcription for demo mode."""
        import random
        samples = [
            "I'm doing okay today, just a bit tired.",
            "Yes, I took my medication this morning.",
            "My knees have been aching a bit lately.",
            "I slept well last night, about 7 hours.",
            "I had porridge for breakfast and some fruit.",
            "My daughter came to visit yesterday, that was nice.",
            "I've been walking in the park every morning.",
            "Sometimes I feel a bit dizzy when I stand up.",
        ]
        return random.choice(samples)

    def _demo_process_audio_turn(
        self, audio_path: str, conversation_history: list[dict], phase_instruction: str
    ) -> dict:
        """Generate a demo response that progresses through the check-in phases."""
        import random
        MERaLiONEngine._demo_turn += 1
        turn = MERaLiONEngine._demo_turn

        transcription = self._demo_transcription()

        moods = ["cheerful", "neutral", "tired", "neutral", "cheerful"]
        mood = moods[turn % len(moods)]

        responses = [
            "That's good to hear! Have you taken your morning medications today — your Metformin and Amlodipine?",
            "Well done for keeping up with your meds! That's very important. How are you feeling physically today — any headaches, dizziness, or discomfort?",
            "I see, thanks for telling me. Make sure to rest if you feel dizzy. Have you been eating well and getting some exercise?",
            "Sounds like you're taking good care of yourself! How are you feeling emotionally — have you been in good spirits?",
            "That's lovely to hear. Remember you have a check-up with Dr. Lim next week. Keep up the good work, and take care ah!",
        ]
        response = responses[min(turn - 1, len(responses) - 1)]

        adherence = "taken" if turn <= 2 else "not_applicable"
        flags = []
        if "dizzy" in transcription.lower() or "aching" in transcription.lower():
            flags = ["mild dizziness reported"]

        return {
            "transcription": transcription,
            "language_detected": "english",
            "response_to_patient": response,
            "health_flags": flags,
            "mood_assessment": mood,
            "adherence_status": adherence,
            "raw_output": f"[DEMO MODE] turn {turn}",
        }

    def _demo_risk_response(self, instruction: str) -> str:
        """Generate a demo risk assessment response."""
        import random
        MERaLiONEngine._demo_turn += 1
        turn = MERaLiONEngine._demo_turn

        responses = [
            "Thank you for sharing that! Can you tell me a bit more — do any of your parents or grandparents have diabetes, high blood pressure, or heart disease?",
            "I see, that's helpful to know. How about your lifestyle — do you exercise regularly, and how would you describe your diet? Any smoking or regular alcohol consumption?",
            "Got it. Have you noticed any symptoms like frequent thirst, tiredness, blurry vision, or needing to urinate often? Also, do you know your last blood pressure or blood sugar reading?",
            "Thanks for all that information! Based on what you've shared, here's what I've noticed:\n\nYou have some risk factors worth monitoring. I'd recommend getting a health screening at your nearest polyclinic — it's subsidised for Singapore residents.\n\nRemember, this is not a diagnosis — just a friendly heads-up to stay proactive about your health!\n\n[RISK_FACTORS] [{\"text\": \"Family history of chronic conditions\", \"level\": \"medium\"}, {\"text\": \"Sedentary lifestyle\", \"level\": \"medium\"}, {\"text\": \"Regular health screening recommended\", \"level\": \"low\"}]",
        ]
        return responses[min(turn - 1, len(responses) - 1)]
