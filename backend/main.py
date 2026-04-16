from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Literal, Optional
from fastapi.middleware.cors import CORSMiddleware
import json
from fastapi.responses import StreamingResponse
import httpx

LM_STUDIO_BASE = "http://127.0.0.1:1234"
MODEL = "bielik-minitron-7b-v3.0-instruct"

app = FastAPI()

origins = [
    "http://localhost:3000",  #Python server
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001", #VS CODE LIVE PREVIEW
    "http://localhost:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    temperature: float = 0.7
    max_tokens: int = 1024
    model: Optional[str] = None  # pozwala nadpisać MODEL z requestu

class ChatResponse(BaseModel):
    content: str
# main.py
@app.get("/api/models")
async def api_models():
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        r = await client.get(f"{LM_STUDIO_BASE}/v1/models")
        r.raise_for_status()
        data = r.json()

        ids = [m.get("id") for m in data.get("data", []) if m.get("id")]

        # Filter chat models from embedding models
        chat_models = [mid for mid in ids if "embed" not in mid.lower() and "embedding" not in mid.lower()]
        return {"models": chat_models}
@app.get("/status")
def status():
    return {"ok": True}

@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    payload = {
        "model": req.model or MODEL,
        "messages": [m.model_dump() for m in req.messages],
        "temperature": req.temperature,
        "max_tokens": req.max_tokens,
        "stream": True,
    }

    async def event_generator():
        try:
            timeout = httpx.Timeout(connect=10.0, read=None, write=30.0, pool=None)
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    f"{LM_STUDIO_BASE}/v1/chat/completions",
                    json=payload,
                ) as r:
                    r.raise_for_status()

                    async for line in r.aiter_lines():
                        if not line:
                            continue

                        # LM Studio (OpenAI-like) zwykle wysyła: "data: {...}" lub "data: [DONE]"
                        if line.startswith("data:"):
                            data_str = line[5:].strip()
                        else:
                            data_str = line.strip()

                        if data_str == "[DONE]":
                            yield "data: [DONE]\n\n"
                            return

                        # Parsujemy i wysyłamy tylko delta content (prościej dla frontu)
                        try:
                            obj = json.loads(data_str)
                            choice = (obj.get("choices") or [{}])[0]
                            delta = (choice.get("delta") or {}).get("content") or ""
                        except Exception:
                            delta = ""

                        if delta:
                            yield f"data: {json.dumps({'delta': delta})}\n\n"

        except Exception as e:
            # event error dla frontu
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )