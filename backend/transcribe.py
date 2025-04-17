from fastapi import Form
import os
import numpy as np
import speech_recognition as sr
import whisper
import torch

from google import genai
from datetime import datetime, timedelta
from queue import Queue
from fastapi import FastAPI, WebSocket, Query, Request, Form
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import threading

from define import get_definition, get_notes

# Configure Gemini API client
gemini_client = genai.Client(api_key="AIzaSyDdqpWRbNrHIfrpJbksYEdCGVeo6R_xBJw")

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


def record_callback(_, audio: sr.AudioData) -> None:
    data = audio.get_raw_data()
    data_queue.put(data)


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

# WebSocket for live transcription


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

# GET endpoint to fetch defintion


@app.get("/define")
async def define(word: str = Query(...)):
    return {"definition": get_definition(word)}

# POST endpoint to fetch notes


@app.post("/notes")
async def notes(request: Request):
    body = await request.json()
    transcription = body.get("transcription")
    notes = get_notes(transcription)
    return {"notes": notes}

# POST endpoint to reset transcription


@app.post("/reset")
async def reset_transcription():
    global transcription, transcription_queue
    transcription = [""]
    with transcription_queue.mutex:
        transcription_queue.queue.clear()
    return {"message": "Transcription reset."}

# GET endpoint to list microphones


@app.get("/list_microphones")
async def list_microphones():
    return {"devices": sr.Microphone.list_microphone_names()}

# POST endpoint to set microphone


@app.post("/set_microphone")
async def set_microphone(device_index: int = Form(...)):
    global source
    try:
        mic_list = sr.Microphone.list_microphone_names()
        if device_index < 0 or device_index >= len(mic_list):
            return {"error": "Invalid microphone index."}

        source = sr.Microphone(sample_rate=16000, device_index=device_index)
        print(f"Switched to microphone: {mic_list[device_index]}")
        return {"message": f"Microphone set to: {mic_list[device_index]}"}
    except Exception as e:
        return {"error": str(e)}

# Start background transcription thread
threading.Thread(target=transcription_loop, daemon=True).start()




