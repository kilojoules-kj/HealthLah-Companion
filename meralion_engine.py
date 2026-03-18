# meralion_engine.py
import torch
import librosa
import numpy as np
from transformers import AutoModelForCausalLM, AutoProcessor
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class MERaLiONEngine:
    """
    Wraps MERaLiON AudioLLM for:
    1. Understanding patient speech (audio → meaning)
    2. Generating contextual responses
    3. Extracting paralinguistic cues from audio
    """

    def __init__(self, model_id: str = "MERaLiON/MERaLiON-AudioLLM-Whisper-SEA-LION"):
        logger.info(f"Loading MERaLiON model: {model_id}")
        self.processor = AutoProcessor.from_pretrained(
            model_id, trust_remote_code=True
        )
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id,
            trust_remote_code=True,
            torch_dtype=torch.float16,
            device_map="auto",
        )
        self.model.eval()
        logger.info("MERaLiON loaded successfully")

    def process_audio_turn(
        self,
        audio_path: str,
        system_prompt: str,
        conversation_history: list[dict],
        current_phase_instruction: str,
    ) -> dict:
        """
        Process one turn of conversation.

        Takes the patient's audio response and returns:
        - transcription: what they said
        - understanding: structured interpretation
        - response: what the AI should say next
        - flags: any health concerns detected
        """

        # Load audio at 16kHz (MERaLiON expects this)
        audio, sr = librosa.load(audio_path, sr=16000)

        # Build the prompt that tells MERaLiON what to do with this audio
        analysis_prompt = self._build_analysis_prompt(
            system_prompt, conversation_history, current_phase_instruction
        )

        # Process through MERaLiON
        # The audio is passed directly — MERaLiON's Whisper encoder handles it
        conversation = [
            {"role": "system", "content": system_prompt},
            *conversation_history,
            {
                "role": "user",
                "content": [
                    {"type": "audio", "audio_url": audio_path},
                    {"type": "text", "text": current_phase_instruction},
                ],
            },
        ]

        inputs = self.processor(
            text=self.processor.apply_chat_template(
                conversation, tokenize=False, add_generation_prompt=True
            ),
            audios=[audio],
            return_tensors="pt",
            sampling_rate=16000,
        )
        inputs = {k: v.to(self.model.device) for k, v in inputs.items()}

        with torch.no_grad():
            output_ids = self.model.generate(
                **inputs,
                max_new_tokens=512,
                temperature=0.7,
                do_sample=True,
                top_p=0.9,
            )

        # Decode only the new tokens
        new_tokens = output_ids[0][inputs["input_ids"].shape[1]:]
        raw_response = self.processor.decode(new_tokens, skip_special_tokens=True)

        # Parse the structured response
        return self._parse_response(raw_response)

    def _build_analysis_prompt(
        self, system_prompt: str, history: list, phase_instruction: str
    ) -> str:
        """Build the instruction for MERaLiON to analyze patient audio"""
        return phase_instruction

    def _parse_response(self, raw: str) -> dict:
        """
        Parse MERaLiON's structured output.
        We prompt it to return in a specific format.
        """
        result = {
            "transcription": "",
            "language_detected": "",
            "response_to_patient": "",
            "health_flags": [],
            "mood_assessment": "",
            "adherence_status": "",
            "raw_output": raw,
        }

        # Parse sections from the structured output
        current_section = None
        for line in raw.strip().split("\n"):
            line = line.strip()
            if line.startswith("[TRANSCRIPTION]"):
                current_section = "transcription"
                result["transcription"] = line.replace("[TRANSCRIPTION]", "").strip()
            elif line.startswith("[LANGUAGE]"):
                result["language_detected"] = line.replace("[LANGUAGE]", "").strip()
            elif line.startswith("[RESPONSE]"):
                current_section = "response"
                result["response_to_patient"] = line.replace("[RESPONSE]", "").strip()
            elif line.startswith("[FLAGS]"):
                flags = line.replace("[FLAGS]", "").strip()
                result["health_flags"] = [f.strip() for f in flags.split(",") if f.strip() and f.strip().lower() != "none"]
            elif line.startswith("[MOOD]"):
                result["mood_assessment"] = line.replace("[MOOD]", "").strip()
            elif line.startswith("[ADHERENCE]"):
                result["adherence_status"] = line.replace("[ADHERENCE]", "").strip()
            elif current_section == "response":
                result["response_to_patient"] += " " + line
            elif current_section == "transcription":
                result["transcription"] += " " + line

        # Fallback if parsing fails — use raw output as response
        if not result["response_to_patient"]:
            result["response_to_patient"] = raw.strip()

        return result


class MERaLiONEngineAPI:
    """
    Alternative: If hackathon provides a hosted MERaLiON API endpoint
    instead of running the model locally.
    """

    def __init__(self, api_url: str, api_key: str):
        self.api_url = api_url
        self.api_key = api_key

    def process_audio_turn(self, audio_path, system_prompt,
                           conversation_history, current_phase_instruction) -> dict:
        import requests
        import base64

        with open(audio_path, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode()

        payload = {
            "audio": audio_b64,
            "system_prompt": system_prompt,
            "conversation_history": conversation_history,
            "instruction": current_phase_instruction,
        }

        resp = requests.post(
            f"{self.api_url}/v1/audio/chat",
            json=payload,
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=30,
        )
        resp.raise_for_status()
        return self._parse_response(resp.json()["content"])