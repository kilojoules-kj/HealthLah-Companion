// ═══════════════════════════════════════════════
// HealthLah Companion — Multi-mode Recorder
// ═══════════════════════════════════════════════

const PATIENT_ID = "patient_001";
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let currentMode = null; // 'risk' | 'patient'

// ── Page Navigation ────────────────────────────

function selectRole(role) {
    document.getElementById('landingPage').classList.remove('active');
    if (role === 'risk') {
        document.getElementById('riskPage').classList.add('active');
        currentMode = 'risk';
    } else if (role === 'patient') {
        document.getElementById('patientPage').classList.add('active');
        currentMode = 'patient';
    } else if (role === 'caretaker') {
        document.getElementById('caretakerPage').classList.add('active');
        currentMode = null;
    }
}

function goHome() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('landingPage').classList.add('active');
    currentMode = null;
}

// ── Chat Helpers ───────────────────────────────

function getChatArea() {
    if (currentMode === 'risk') return document.getElementById('riskChatArea');
    if (currentMode === 'patient') return document.getElementById('patientChatArea');
    return null;
}

function addMessage(text, role, phase, audioUrl) {
    const chatArea = getChatArea();
    if (!chatArea) return;

    const msg = document.createElement('div');
    msg.className = `message ${role}`;

    let html = '';
    if (phase) html += `<div class="phase-badge">${phase}</div>`;
    html += `<div class="bubble">${text}</div>`;
    msg.innerHTML = html;

    chatArea.appendChild(msg);
    chatArea.scrollTop = chatArea.scrollHeight;

    // Play AI audio response
    if (audioUrl && role === 'ai') {
        const audio = new Audio(audioUrl);
        audio.play().then(() => {
            audio.onended = () => enableMic();
        }).catch(() => enableMic());
    }
}

function enableMic() {
    const btn = currentMode === 'risk'
        ? document.getElementById('riskRecordBtn')
        : document.getElementById('patientRecordBtn');
    if (btn) btn.disabled = false;
}

// ── Phase Tracker (Patient mode) ───────────────

let completedPhases = [];

function updatePhase(phase) {
    if (!phase || currentMode !== 'patient') return;

    // Mark previous phases as done
    const phases = ['greeting', 'medication_check', 'symptom_screening',
                    'lifestyle_check', 'emotional_wellbeing', 'wrap_up'];
    const currentIdx = phases.indexOf(phase);

    phases.forEach((p, idx) => {
        const el = document.getElementById(`phase-${p}`);
        if (!el) return;
        el.classList.remove('active', 'done');
        if (idx < currentIdx) el.classList.add('done');
        else if (idx === currentIdx) el.classList.add('active');
    });

    // Update call status
    const status = document.getElementById('callStatus');
    if (status) {
        status.textContent = phase === 'completed' ? 'Completed' : 'In Progress';
        status.className = 'call-status' + (phase !== 'completed' ? ' active' : '');
    }
}

function updateMood(mood) {
    if (!mood) return;
    const el = document.getElementById('moodDisplay');
    if (!el) return;

    const moodText = mood.charAt(0).toUpperCase() + mood.slice(1);
    el.textContent = moodText;

    el.className = 'mood-display';
    const positive = ['cheerful'];
    const neutral = ['neutral'];
    const negative = ['tired', 'anxious', 'sad'];
    const critical = ['confused', 'distressed'];

    if (positive.includes(mood)) el.classList.add('positive');
    else if (neutral.includes(mood)) el.classList.add('neutral');
    else if (negative.includes(mood)) el.classList.add('negative');
    else if (critical.includes(mood)) el.classList.add('critical');
}

function showFlags(flags) {
    const area = document.getElementById('flagArea');
    if (!area) return;

    area.innerHTML = '';
    if (!flags || flags.length === 0) return;

    flags.forEach(flag => {
        const div = document.createElement('div');
        const isEmergency = flag.toUpperCase().includes('EMERGENCY');
        div.className = `flag-item ${isEmergency ? 'emergency' : ''}`;
        div.textContent = flag;
        area.appendChild(div);
    });
}

// ── Patient Check-in Flow ──────────────────────

async function startCall() {
    document.getElementById('patientStartBtn').style.display = 'none';
    document.getElementById('patientRecordBtn').style.display = 'flex';
    document.getElementById('patientHint').textContent = 'Tap the microphone and speak naturally';

    try {
        const resp = await fetch(`/api/start-call/${PATIENT_ID}`, { method: 'POST' });
        const data = await resp.json();
        addMessage(data.message, 'ai', data.phase, data.audio_url);
        updatePhase(data.phase);
    } catch (err) {
        addMessage('Unable to start call. Please check your connection.', 'ai', 'error', null);
    }
}

// ── Recording ──────────────────────────────────

async function toggleRecording(mode) {
    currentMode = mode;
    const btn = mode === 'risk'
        ? document.getElementById('riskRecordBtn')
        : document.getElementById('patientRecordBtn');
    const hint = mode === 'risk'
        ? document.getElementById('riskHint')
        : document.getElementById('patientHint');

    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            });

            mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            audioChunks = [];

            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                const wavBlob = await convertToWav(blob);

                if (mode === 'patient') {
                    await sendPatientAudio(wavBlob);
                } else {
                    await sendRiskAudio(wavBlob);
                }

                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            isRecording = true;
            btn.classList.add('recording');
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
            hint.textContent = 'Listening... tap to stop';
        } catch (err) {
            hint.textContent = 'Microphone access denied. Please allow microphone access.';
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        btn.classList.remove('recording');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>';
        btn.disabled = true;
        hint.textContent = 'Processing your response...';
    }
}

// ── Send Audio (Patient Mode) ──────────────────

async function sendPatientAudio(blob) {
    const formData = new FormData();
    formData.append('audio', blob, 'response.wav');

    addMessage('Processing your response...', 'patient', '', null);
    const chatArea = getChatArea();
    const processingMsg = chatArea.lastElementChild;
    processingMsg.classList.add('processing');

    try {
        const resp = await fetch(`/api/respond/${PATIENT_ID}`, {
            method: 'POST',
            body: formData,
        });
        const data = await resp.json();

        // Replace processing placeholder with transcription
        processingMsg.classList.remove('processing');
        processingMsg.querySelector('.bubble').textContent =
            data.patient_said || '(audio processed)';

        addMessage(data.ai_message, 'ai', data.phase, data.audio_url);

        updatePhase(data.phase);
        updateMood(data.mood);

        if (data.health_flags && data.health_flags.length > 0) {
            showFlags(data.health_flags);
        }

        if (data.call_summary) {
            addMessage('Check-in complete. Summary has been saved to the caretaker dashboard.', 'ai', 'completed', null);
            document.getElementById('patientRecordBtn').disabled = true;
            document.getElementById('patientHint').textContent = 'Check-in completed';
        }
    } catch (err) {
        processingMsg.classList.remove('processing');
        processingMsg.querySelector('.bubble').textContent = 'Failed to process audio.';
        addMessage('Connection error. Please try again.', 'ai', 'error', null);
        enableMic();
    }
}

// ── Send Audio (Risk Assessment Mode) ──────────

async function sendRiskAudio(blob) {
    const formData = new FormData();
    formData.append('audio', blob, 'response.wav');

    addMessage('Processing your response...', 'patient', '', null);
    const chatArea = getChatArea();
    const processingMsg = chatArea.lastElementChild;
    processingMsg.classList.add('processing');

    try {
        const resp = await fetch('/api/risk-chat', {
            method: 'POST',
            body: formData,
        });
        const data = await resp.json();

        // Replace processing placeholder with transcription
        processingMsg.classList.remove('processing');
        processingMsg.querySelector('.bubble').textContent =
            data.transcription || '(audio processed)';

        addMessage(data.response, 'ai', '', null);

        // Update risk factors panel
        if (data.risk_factors && data.risk_factors.length > 0) {
            updateRiskFactors(data.risk_factors);
        }

        enableMic();
    } catch (err) {
        processingMsg.classList.remove('processing');
        processingMsg.querySelector('.bubble').textContent = 'Failed to process audio.';
        addMessage('Connection error. Please try again.', 'ai', 'error', null);
        enableMic();
    }
}

function updateRiskFactors(factors) {
    const area = document.getElementById('riskFactors');
    if (!area) return;

    area.innerHTML = '';
    factors.forEach(f => {
        const div = document.createElement('div');
        div.className = 'factor-item';
        const level = f.level || 'medium';
        div.innerHTML = `<span class="factor-dot ${level}"></span><span>${f.text}</span>`;
        area.appendChild(div);
    });
}

// ── WAV Conversion ─────────────────────────────

async function convertToWav(webmBlob) {
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
    });
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const numChannels = 1;
    const sampleRate = 16000;
    const samples = audioBuffer.getChannelData(0);
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
        for (let i = 0; i < str.length; i++)
            view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
    }

    audioCtx.close();
    return new Blob([buffer], { type: 'audio/wav' });
}
