import os
import numpy as np
import speech_recognition as sr
import whisper
import torch

from datetime import datetime, timedelta
from queue import Queue
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import asyncio
import threading

# FastAPI setup
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared transcription queue for WebSocket
clients = set()
transcription_queue = Queue()

# Speech Recognition setup
recorder = sr.Recognizer()
recorder.energy_threshold = 100
recorder.dynamic_energy_threshold = False
source = sr.Microphone(sample_rate=16000)
model = whisper.load_model("medium.en")
record_timeout = 1
phrase_timeout = 1
phrase_time = None

data_queue = Queue()
transcription = ['']

# Thread-safe audio callback


def record_callback(_, audio: sr.AudioData) -> None:
    data = audio.get_raw_data()
    data_queue.put(data)

# Background transcription thread


def transcription_loop():
    global phrase_time
    with source:
        recorder.adjust_for_ambient_noise(source)
    recorder.listen_in_background(
        source, record_callback, phrase_time_limit=record_timeout)

    print("Ready to transcribe...")
    while True:
        if not data_queue.empty():
            now = datetime.now()
            phrase_complete = False
            if phrase_time and now - phrase_time > timedelta(seconds=phrase_timeout):
                phrase_complete = True
            phrase_time = now

            audio_data = b''.join(data_queue.queue)
            data_queue.queue.clear()

            audio_np = np.frombuffer(
                audio_data, dtype=np.int16).astype(np.float32) / 32768.0
            result = model.transcribe(audio_np, fp16=torch.cuda.is_available())
            text = result['text'].strip()

            if phrase_complete:
                transcription.append(text)
            else:
                transcription[-1] += text

            transcription_text = "\n".join(transcription)
            transcription_queue.put(transcription_text)

        else:
            asyncio.run(asyncio.sleep(0.25))

# WebSocket endpoint


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)
    try:
        while True:
            if not transcription_queue.empty():
                message = transcription_queue.get()
                await websocket.send_text(message)
            await asyncio.sleep(0.5)
    except Exception as e:
        print(f"WebSocket closed: {e}")
    finally:
        clients.remove(websocket)

# Start background transcription thread
threading.Thread(target=transcription_loop, daemon=True).start()
