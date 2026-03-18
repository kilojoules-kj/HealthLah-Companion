# tts_engine.py
import edge_tts
import asyncio
import uuid
import os

class TTSEngine:
    """Convert AI responses to speech in patient's preferred language."""

    VOICE_MAP = {
        "english": "en-SG-LunaNeural",       # Singapore English
        "mandarin": "zh-CN-XiaoxiaoNeural",   # Mandarin
        "malay": "ms-MY-YasminNeural",         # Malay
        "tamil": "ta-IN-PallaviNeural",        # Tamil
        "hokkien": "zh-CN-XiaoxiaoNeural",     # fallback to Mandarin
    }

    def __init__(self, output_dir: str = "data/tts_output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def speak(self, text: str, language: str = "english") -> str:
        """Convert text to speech, return path to audio file."""
        voice = self.VOICE_MAP.get(language, self.VOICE_MAP["english"])
        output_path = os.path.join(self.output_dir, f"{uuid.uuid4().hex}.mp3")

        asyncio.run(self._generate(text, voice, output_path))
        return output_path

    async def _generate(self, text: str, voice: str, output_path: str):
        communicate = edge_tts.Communicate(text, voice, rate="-10%")  # slightly slower for elderly
        await communicate.save(output_path)