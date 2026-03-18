# main.py
import uvicorn
import schedule
import threading
import time as time_module
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from patient_profile import load_patient
from meralion_engine import MERaLiONEngine
from conversation_manager import ConversationManager
from tts_engine import TTSEngine


def run_scheduler():
    """Background thread: trigger proactive calls at scheduled times."""
    # In production, this would check patient schedules and initiate calls
    # For hackathon, calls are triggered via the web UI
    while True:
        schedule.run_pending()
        time_module.sleep(60)


if __name__ == "__main__":
    # Start scheduler in background
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()

    # Start web server
    print("\n" + "="*50)
    print("  🤝 HealthLah Companion is running!")
    print("  Open http://localhost:8000 to start a check-in")
    print("="*50 + "\n")

    uvicorn.run("web_demo.app:app", host="0.0.0.0", port=8000, reload=True)