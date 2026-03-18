# web_demo/app.py
from fastapi import FastAPI, UploadFile, File, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from dotenv import load_dotenv
import shutil, uuid, os

load_dotenv()

from meralion_engine import MERaLiONEngine
from conversation_manager import ConversationManager
from tts_engine import TTSEngine
from patient_profile import load_patient

app = FastAPI(title="HealthLah Companion Web Demo")
app.mount("/static", StaticFiles(directory="web_demo/static"), name="static")

# Initialize
meralion = MERaLiONEngine()
tts = TTSEngine()
conv_manager = ConversationManager(meralion, tts)

os.makedirs("data/uploads", exist_ok=True)
os.makedirs("data/calls", exist_ok=True)


@app.get("/", response_class=HTMLResponse)
async def home():
    with open("web_demo/templates/call_ui.html", encoding="utf-8") as f:
        return f.read()


@app.post("/api/start-call/{patient_id}")
async def start_call(patient_id: str):
    """Initiate a proactive check-in call."""
    patient = load_patient(patient_id)
    result = conv_manager.start_call(patient)
    return {
        "message": result["text"],
        "audio_url": f"/api/audio/{os.path.basename(result['audio_path'])}",
        "phase": result["phase"],
    }


@app.post("/api/respond/{patient_id}")
async def patient_responds(patient_id: str, audio: UploadFile = File(...)):
    """Patient speaks — process their audio through MERaLiON."""
    # Save uploaded audio
    audio_path = f"data/uploads/{uuid.uuid4().hex}.wav"
    with open(audio_path, "wb") as f:
        shutil.copyfileobj(audio.file, f)

    # Process through conversation manager → MERaLiON
    result = conv_manager.process_patient_response(patient_id, audio_path)

    response = {
        "ai_message": result["text"],
        "audio_url": f"/api/audio/{os.path.basename(result['audio_path'])}",
        "phase": result["phase"],
        "patient_said": result.get("transcription", ""),
        "mood": result.get("mood", ""),
        "health_flags": result.get("health_flags", []),
    }

    if result.get("call_summary"):
        response["call_summary"] = result["call_summary"]

    if result.get("emergency"):
        response["emergency"] = True

    return response


# ── Risk Assessment Chat ──────────────────────────

# In-memory conversation state per session (simplified for hackathon)
risk_sessions: dict[str, list[dict]] = {}

RISK_SYSTEM_PROMPT = """You are Kawan, a warm and professional health screening assistant
in Singapore. You help people understand if they might be at risk for chronic conditions
like Type 2 Diabetes, Hypertension, Cardiovascular Disease, Chronic Kidney Disease,
or Hyperlipidaemia.

Ask questions conversationally — one or two at a time — about:
- Age, gender, ethnicity
- Family history of chronic illness
- Lifestyle: diet, exercise, smoking, alcohol
- Known symptoms: frequent urination, fatigue, headaches, blurry vision, numbness
- Recent health checks: blood pressure, blood sugar, cholesterol levels
- BMI / weight concerns

After gathering enough information (usually 4-6 exchanges), provide a summary of
risk factors you've identified. Be clear this is NOT a diagnosis.

If the person speaks Mandarin, Malay, Tamil, or Singlish, respond in their language.

Keep responses SHORT (2-3 sentences) since this is a voice conversation.

At the end of your message, add a line starting with [RISK_FACTORS] containing a
JSON array of detected risk factors, e.g.:
[RISK_FACTORS] [{"text": "Family history of diabetes", "level": "high"}, {"text": "Sedentary lifestyle", "level": "medium"}]
If no risk factors detected yet, omit this line."""


@app.post("/api/risk-chat")
async def risk_chat(audio: UploadFile = File(...)):
    """Risk assessment voice chat — transcribe + respond."""
    import json as _json

    audio_path = f"data/uploads/{uuid.uuid4().hex}.wav"
    with open(audio_path, "wb") as f:
        shutil.copyfileobj(audio.file, f)

    # Use a simple session key (single user for hackathon demo)
    session_id = "default"
    if session_id not in risk_sessions:
        risk_sessions[session_id] = []

    history = risk_sessions[session_id]

    # Transcribe the audio
    transcription = meralion.transcribe_only(audio_path)

    # Add to history
    history.append({"role": "user", "content": transcription})

    # Build instruction with conversation context
    history_text = "\n".join(
        f"{'User' if h['role'] == 'user' else 'Kawan'}: {h['content']}"
        for h in history[-10:]
    )

    instruction = f"""{RISK_SYSTEM_PROMPT}

Conversation so far:
{history_text}

Respond to the user's latest message. Remember to keep it short and conversational."""

    # Get response (text-only, no audio needed for this call)
    response_text = meralion.process_with_instruction(audio_path, instruction)

    # Parse out risk factors if present
    risk_factors = []
    clean_response = response_text
    if "[RISK_FACTORS]" in response_text:
        parts = response_text.split("[RISK_FACTORS]")
        clean_response = parts[0].strip()
        try:
            risk_factors = _json.loads(parts[1].strip())
        except (ValueError, IndexError):
            pass

    history.append({"role": "assistant", "content": clean_response})

    return {
        "transcription": transcription,
        "response": clean_response,
        "risk_factors": risk_factors,
    }


@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    return FileResponse(f"data/tts_output/{filename}")