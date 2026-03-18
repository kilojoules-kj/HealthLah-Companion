# meralion_engine.py — MERaLiON API engine (hosted, OpenAI-compatible)
import base64
import pathlib
import logging
import os

from openai import OpenAI

logger = logging.getLogger(__name__)

# MERaLiON hosted API (OpenAI-compatible)
MERALION_BASE_URL = "http://meralion.org:8010/v1"
MERALION_MODEL = "MERaLiON/MERaLiON-3-10B"


class MERaLiONEngine:
    """
    MERaLiON AudioLLM wrapper — uses the hosted MERaLiON API.

    The API is OpenAI-compatible, so we use the OpenAI SDK pointed at
    http://meralion.org:8010.  Audio is sent as base64 data URLs.

    No local model download, no GPU required.
    """

    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("MERALION_API_KEY", "")
        if not self.api_key:
            logger.warning(
                "MERALION_API_KEY not set — API calls will fail. "
                "Register at http://meralion.org:8010 to get a key."
            )

        self.client = OpenAI(
            base_url=MERALION_BASE_URL,
            api_key=self.api_key,
        )
        self.model = MERALION_MODEL
        logger.info(f"MERaLiON API engine ready (model={self.model})")

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
        """
        audio_url = self._audio_to_data_url(audio_path)

        # Build the full instruction for this turn
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

    def transcribe_only(self, audio_path: str) -> str:
        """Simple transcription via the /audio/transcription endpoint."""
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

    def process_with_instruction(self, audio_path: str, instruction: str) -> str:
        """Send audio + a single instruction to MERaLiON."""
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
