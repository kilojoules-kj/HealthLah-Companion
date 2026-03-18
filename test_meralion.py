# test_meralion.py
"""Run this to verify MERaLiON loads and works."""

from meralion_engine import MERaLiONEngine
import tempfile
import numpy as np
import soundfile as sf

def create_test_audio():
    """Create a short silent audio file for testing."""
    sr = 16000
    duration = 2  # seconds
    audio = np.zeros(int(sr * duration), dtype=np.float32)
    path = tempfile.mktemp(suffix=".wav")
    sf.write(path, audio, sr)
    return path

def main():
    print("Loading MERaLiON...")
    engine = MERaLiONEngine()
    print(f"✅ Model loaded: {type(engine.model).__name__}")
    print(f"   Device: {engine.device}")
    print()

    # Test 1: Simple transcription
    print("Test 1: Transcribe silent audio...")
    test_audio = create_test_audio()
    try:
        result = engine.transcribe_only(test_audio)
        print(f"  Result: '{result}'")
        print("  ✅ Transcription works")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    print()

    # Test 2: Audio + instruction
    print("Test 2: Audio + instruction...")
    try:
        result = engine.process_with_instruction(
            test_audio,
            "Listen to this audio. What language is the speaker using? "
            "How do they sound emotionally?"
        )
        print(f"  Result: '{result}'")
        print("  ✅ Instruction processing works")
    except Exception as e:
        print(f"  ❌ Error: {e}")
    print()

    # Test 3: Full structured turn
    print("Test 3: Full conversation turn...")
    try:
        result = engine.process_audio_turn(
            audio_path=test_audio,
            system_prompt="You are Kawan, a caring health companion.",
            conversation_history=[],
            current_phase_instruction="The patient just greeted you. "
                "Listen to their audio and respond warmly.",
        )
        print(f"  Transcription: {result['transcription']}")
        print(f"  Language: {result['language_detected']}")
        print(f"  Mood: {result['mood_assessment']}")
        print(f"  Response: {result['response_to_patient']}")
        print(f"  Flags: {result['health_flags']}")
        print("  ✅ Full turn works")
    except Exception as e:
        print(f"  ❌ Error: {e}")

    print()
    print("=" * 50)
    print("If all tests pass, MERaLiON is ready!")
    print("Run: python main.py")

if __name__ == "__main__":
    main()