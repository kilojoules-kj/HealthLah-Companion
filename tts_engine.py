# tts_engine.py
import asyncio
import uuid
import os
import logging

logger = logging.getLogger(__name__)

try:
    import edge_tts
    HAS_EDGE_TTS = True
except ImportError:
    HAS_EDGE_TTS = False
    logger.warning("edge_tts not installed — TTS will be disabled. Install with: pip install edge-tts")


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

        if not HAS_EDGE_TTS:
            logger.warning("TTS skipped (edge_tts not available)")
            return output_path  # return path even though file won't exist

        try:
            # Use get_event_loop if one is already running, otherwise asyncio.run
            try:
                loop = asyncio.get_running_loop()
                # If there's already a running loop, schedule as a task
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    pool.submit(asyncio.run, self._generate(text, voice, output_path)).result()
            except RuntimeError:
                asyncio.run(self._generate(text, voice, output_path))
        except Exception as e:
            logger.warning(f"TTS generation failed: {e}")

        return output_path

    async def _generate(self, text: str, voice: str, output_path: str):
        communicate = edge_tts.Communicate(text, voice, rate="-10%")  # slightly slower for elderly
        await communicate.save(output_path)