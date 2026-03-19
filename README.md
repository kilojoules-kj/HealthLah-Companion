# HealthLah Companion 🤝

**Every conversation is a care intervention.**

A proactive, voice-first AI health companion powered by
MERaLiON AudioLLM that calls elderly patients in their
preferred language, conducts natural daily check-ins, detects
health deterioration through vocal cues, and bridges the
communication gap between patients, caregivers, and doctors.

> Built for the NUS–SYNAPXE–IMDA AI Innovation Challenge 2026
> Theme: *Empower Patients, Enable Community, Elevate Healthcare*

---

## 🤔 The Problem

In Singapore, **1.8 million people** live with diabetes,
hypertension, or high lipid levels — many unaware of their
condition. For elderly patients like Mr. Tan (67, diabetic,
hypertensive), managing health means:

- 💊 Remembering multiple daily medications
- 📅 Keeping track of specialist appointments
- 🏥 Recognising warning symptoms early enough to act
- 😔 Coping with isolation and declining mobility

Most health apps assume users can **type, read small text,
and navigate complex UIs**. Mr. Tan speaks Mandarin at home,
struggles with smartphones, and lives alone.

**HealthLah meets him where he is — through voice.**

---

## 💡 The Solution

HealthLah is an AI companion that **proactively calls**
patients — not the other way around.

| What it does | How |
|---|---|
| 📞 Daily voice check-ins | Calls patient at their preferred time |
| 🗣️ Speaks their language | Mandarin, Malay, Tamil, English, Singlish |
| 💊 Medication adherence | Gently asks and tracks compliance |
| 🩺 Symptom screening | Detects health concerns from conversation |
| 🎵 Vocal biomarker analysis | Catches breathlessness, slurring, tremor |
| 😊 Emotional wellbeing | Detects loneliness, confusion, distress |
| 🚨 Smart escalation | Alerts caregivers or 995 when needed |
| 📋 Caregiver dashboard | English summaries of each check-in |

---

## 🏗️ Architecture
![Architecture Overview](Architecture.png)


## 🔧 Tech Stack

| Component | Technology |
|---|---|
| Audio LLM | MERaLiON AudioLLM |
| Text-to-Speech | Edge TTS (multilingual) |
| Backend | FastAPI (Python) |
| Frontend | HTML/JS (browser-based demo) |
| Scheduling | APScheduler |

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+ (for the caregiver dashboard frontend)
- A MERaLiON API key (optional — falls back to demo mode without one)

### 1. Clone the repository

```bash
git clone https://github.com/kilojoules-kj/HealthLah-Companion.git
cd HealthLah-Companion
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
# MERaLiON AudioLLM API key (leave blank to run in demo mode)
MERALION_API_KEY=your_key_here

# Supabase (for caregiver dashboard persistence)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key_here
```

> **Demo mode**: If `MERALION_API_KEY` is not set, the app runs with scripted
> responses so you can explore the UI without an API key.

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 4. Start the backend

```bash
python main.py
```

Open **http://localhost:8000** in your browser to access the voice check-in UI.

### 5. (Optional) Start the caregiver dashboard

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** to view the caregiver dashboard with patient
summaries, call history, and alert management.

### 6. Run your first check-in

1. Navigate to **http://localhost:8000**
2. Select a patient (e.g. `patient_001` — Mr. Tan, pre-loaded in `data/patients.json`)
3. Click **Start Call**
4. Speak into your microphone — HealthLah will respond in the patient's preferred language
5. View the AI-generated summary and caregiver alert (if triggered) in the dashboard

---

### Patient data

Sample patients are stored in `data/patients.json`. Each entry includes:

| Field | Description |
|---|---|
| `preferred_language` | `english`, `mandarin`, `malay`, `tamil` |
| `conditions` | Chronic conditions (diabetes, hypertension, etc.) |
| `medications` | Medication list with dosage and schedule |
| `call_schedule` | Preferred daily check-in time (24-hour, e.g. `"09:00"`) |
| `emergency_contact` | Name, phone, and relation of caregiver |

---
