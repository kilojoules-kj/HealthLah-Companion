# meralion_engine.py (FIXED)
import torch
import librosa
import numpy as np
import logging
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor

# Compatibility patch for transformers 5.x:
# HybridCache was removed in v5.2 and replaced by StaticCache.
# The MERaLiON remote model code still imports HybridCache, so we
# alias it here before the model is loaded via trust_remote_code.
import transformers.cache_utils as _cache_utils
if not hasattr(_cache_utils, "HybridCache"):
    from transformers.cache_utils import StaticCache
    _cache_utils.HybridCache = StaticCache

logger = logging.getLogger(__name__)


class MERaLiONEngine:
    """
    MERaLiON AudioLLM wrapper.
    
    Architecture: Whisper encoder + SEA-LION decoder
    Auto class:   AutoModelForSpeechSeq2Seq
    Model class:  MERaLiONForConditionalGeneration
    
    Input:  audio waveform + text prompt
    Output: generated text
    """

    def __init__(
        self,
        model_id: str = "MERaLiON/MERaLiON-AudioLLM-Whisper-SEA-LION",
        device: str = None,
    ):
        logger.info(f"Loading MERaLiON: {model_id}")

        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")

        # Load processor (handles audio feature extraction + tokenization)
        self.processor = AutoProcessor.from_pretrained(
            model_id, trust_remote_code=True
        )

        # Load model with CORRECT auto class
        self.model = AutoModelForSpeechSeq2Seq.from_pretrained(
            model_id,
            trust_remote_code=True,
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
            device_map="auto" if self.device == "cuda" else None,
        )

        if self.device == "cpu":
            self.model = self.model.to(self.device)

        self.model.eval()
        logger.info(f"MERaLiON loaded on {self.device}")
        logger.info(f"Model class: {type(self.model).__name__}")

    def process_audio_turn(
        self,
        audio_path: str,
        system_prompt: str,
        conversation_history: list[dict],
        current_phase_instruction: str,
    ) -> dict:
        """
        Process one turn: patient audio → MERaLiON → structured response.
        
        Since MERaLiON is encoder-decoder (not causal):
        - Audio → Whisper encoder → audio features
        - Text prompt → decoder prompt
        - Model generates response conditioned on BOTH
        """

        # 1. Load audio
        audio, sr = librosa.load(audio_path, sr=16000)
        logger.info(
            f"Audio loaded: {len(audio)/sr:.1f}s, sr={sr}"
        )

        # 2. Build the text prompt
        #    Since this is seq2seq, we combine system + history + instruction
        #    into a single text prompt that conditions the decoder
        text_prompt = self._build_prompt(
            system_prompt,
            conversation_history,
            current_phase_instruction,
        )

        # 3. Process through MERaLiON processor
        #    This extracts mel spectrogram features from audio
        #    AND tokenizes the text prompt
        inputs = self.processor(
            audio=audio,
            sampling_rate=16000,
            text=text_prompt,
            return_tensors="pt",
        )

        # Move to device
        inputs = {k: v.to(self.model.device) for k, v in inputs.items()}

        # 4. Generate
        with torch.no_grad():
            output_ids = self.model.generate(
                **inputs,
                max_new_tokens=512,
                temperature=0.7,
                do_sample=True,
                top_p=0.9,
                # Whisper-style models often need these:
                language="en",  # or None to auto-detect
                task="transcribe",
            )

        # 5. Decode
        raw_response = self.processor.batch_decode(
            output_ids, skip_special_tokens=True
        )[0]

        logger.info(f"Raw response: {raw_response[:200]}...")

        # 6. Parse structured output
        return self._parse_response(raw_response)

    def transcribe_only(self, audio_path: str) -> str:
        """Simple transcription — useful for testing."""
        audio, sr = librosa.load(audio_path, sr=16000)

        inputs = self.processor(
            audio=audio,
            sampling_rate=16000,
            return_tensors="pt",
        )
        inputs = {k: v.to(self.model.device) for k, v in inputs.items()}

        with torch.no_grad():
            output_ids = self.model.generate(
                **inputs,
                max_new_tokens=256,
            )

        return self.processor.batch_decode(
            output_ids, skip_special_tokens=True
        )[0]

    def process_with_instruction(
        self, audio_path: str, instruction: str
    ) -> str:
        """
        Send audio + a single instruction to MERaLiON.
        Most flexible method — use this if structured prompting
        doesn't work well.
        """
        audio, sr = librosa.load(audio_path, sr=16000)

        inputs = self.processor(
            audio=audio,
            sampling_rate=16000,
            text=instruction,
            return_tensors="pt",
        )
        inputs = {k: v.to(self.model.device) for k, v in inputs.items()}

        with torch.no_grad():
            output_ids = self.model.generate(
                **inputs,
                max_new_tokens=512,
                temperature=0.7,
                do_sample=True,
            )

        return self.processor.batch_decode(
            output_ids, skip_special_tokens=True
        )[0]

    def _build_prompt(
        self,
        system_prompt: str,
        conversation_history: list[dict],
        phase_instruction: str,
    ) -> str:
        """
        Build a single text prompt for the decoder.
        
        For encoder-decoder models, we can't do multi-turn chat 
        the same way as causal LLMs. Instead we pack context into
        one prompt that tells the model what to do with the audio.
        """

        # Format recent conversation history as text
        history_text = ""
        if conversation_history:
            recent = conversation_history[-6:]  # last 6 turns
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
                result["transcription"] = line.replace(
                    "[TRANSCRIPTION]", ""
                ).strip()
            elif line.startswith("[LANGUAGE]"):
                current_section = None
                result["language_detected"] = line.replace(
                    "[LANGUAGE]", ""
                ).strip()
            elif line.startswith("[MOOD]"):
                current_section = None
                result["mood_assessment"] = line.replace(
                    "[MOOD]", ""
                ).strip()
            elif line.startswith("[ADHERENCE]"):
                current_section = None
                result["adherence_status"] = line.replace(
                    "[ADHERENCE]", ""
                ).strip()
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
                result["response_to_patient"] = line.replace(
                    "[RESPONSE]", ""
                ).strip()
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