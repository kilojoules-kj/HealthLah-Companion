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
    with open("web_demo/templates/call_ui.html") as f:
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


@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    return FileResponse(f"data/tts_output/{filename}")