const PATIENT_ID = "patient_001";
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

function addMessage(text, role, phase, audioUrl) {
    const chatArea = document.getElementById('chatArea');
    const msg = document.createElement('div');
    msg.className = `message ${role}`;
    msg.innerHTML = `
        <div class="phase-badge">${phase || ''}</div>
        <div class="bubble">${text}</div>
    `;
    chatArea.appendChild(msg);
    chatArea.scrollTop = chatArea.scrollHeight;

    if (audioUrl && role === 'ai') {
        const audio = new Audio(audioUrl);
        audio.play().then(() => {
            audio.onended = () => {
                document.getElementById('recordBtn').disabled = false;
            };
        });
    }
}

function showFlags(flags) {
    const area = document.getElementById('flagArea');
    area.innerHTML = '';
    flags.forEach(flag => {
        const div = document.createElement('div');
        div.className = `flag ${flag.includes('EMERGENCY') ? 'emergency' : ''}`;
        div.textContent = `⚠️ ${flag}`;
        area.appendChild(div);
    });
}

async function startCall() {
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('recordBtn').style.display = 'block';

    const resp = await fetch(`/api/start-call/${PATIENT_ID}`, {
        method: 'POST'
    });
    const data = await resp.json();
    addMessage(data.message, 'ai', data.phase, data.audio_url);
}

async function toggleRecording() {
    if (!isRecording) {
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

            // Convert to WAV for MERaLiON compatibility
            const wavBlob = await convertToWav(blob);
            await sendAudio(wavBlob);

            // Stop mic access
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        isRecording = true;
        document.getElementById('recordBtn').classList.add('recording');
        document.getElementById('recordBtn').textContent = '⏹';
    } else {
        mediaRecorder.stop();
        isRecording = false;
        document.getElementById('recordBtn').classList.remove('recording');
        document.getElementById('recordBtn').textContent = '🎤';
        document.getElementById('recordBtn').disabled = true;
    }
}

async function convertToWav(webmBlob) {
    // Decode webm to raw audio using Web Audio API
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
    });
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Encode as WAV
    const numChannels = 1;
    const sampleRate = 16000;
    const samples = audioBuffer.getChannelData(0);
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // WAV header
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

    // Write samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
    }

    audioCtx.close();
    return new Blob([buffer], { type: 'audio/wav' });
}

async function sendAudio(blob) {
    const formData = new FormData();
    formData.append('audio', blob, 'response.wav');

    addMessage('🎙️ Processing...', 'patient', '', null);

    try {
        const resp = await fetch(`/api/respond/${PATIENT_ID}`, {
            method: 'POST',
            body: formData,
        });
        const data = await resp.json();

        // Replace placeholder with transcription
        const messages = document.querySelectorAll('.message.patient');
        const last = messages[messages.length - 1];
        last.querySelector('.bubble').textContent =
            data.patient_said || '(audio processed)';

        addMessage(data.ai_message, 'ai', data.phase, data.audio_url);

        if (data.mood) {
            document.getElementById('moodIndicator').textContent =
                `Detected mood: ${data.mood}`;
        }

        if (data.health_flags && data.health_flags.length > 0) {
            showFlags(data.health_flags);
        }

        if (data.call_summary) {
            addMessage(
                '📋 Call Complete! Summary saved to caregiver dashboard.',
                'ai', 'completed', null
            );
            document.getElementById('recordBtn').disabled = true;
        }
    } catch (err) {
        console.error('Error:', err);
        addMessage('⚠️ Connection error. Please try again.', 'ai', 'error', null);
        document.getElementById('recordBtn').disabled = false;
    }
}