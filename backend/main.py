import json
import os
from typing import List, Literal, Optional

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# LM Studio Address
LM_STUDIO_BASE = os.getenv("LM_STUDIO_BASE", "http://127.0.0.1:1234")
# Default Model
DEFAULT_MODEL = os.getenv("LM_STUDIO_MODEL", "bielik-minitron-7b-v3.0-instruct")

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    ",".join(
        [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://localhost:3001",
        ]
    ),
)

app = FastAPI()

origins = [origin.strip() for origin in CORS_ORIGINS.split(",") if origin.strip()]

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

#Validate input on backend //Normally validated in front but added just in case of changing using dev tools
class ChatRequest(BaseModel):
    messages: List[Message]
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1024, ge=1, le=4096)
    model: Optional[str] = None

#Helper function to handle creating payload
def build_chat_payload(req: ChatRequest) -> dict:
    return {
        "model": req.model or DEFAULT_MODEL,
        "messages": [message.model_dump() for message in req.messages],
        "temperature": req.temperature,
        "max_tokens": req.max_tokens,
        "stream": True,
    }


# Extracting delta content helper fun,
def extract_delta_content(data_str: str) -> str:
    try:
        obj = json.loads(data_str)
        choice = (obj.get("choices") or [{}])[0]
        return (choice.get("delta") or {}).get("content") or ""

    except Exception:
        return ""

# Fetch models list, filter embedding models
async def fetch_chat_models():
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        response = await client.get(f"{LM_STUDIO_BASE}/v1/models")
        response.raise_for_status()
        data = response.json()

    ids = [model.get("id") for model in data.get("data", []) if model.get("id")]
    chat_models = [
        model_id
        for model_id in ids
        if "embed" not in model_id.lower() and "embedding" not in model_id.lower()
    ]

    return chat_models

# Request models
@app.get("/api/models")
async def api_models():
    chat_models = await fetch_chat_models()
    return {"models": chat_models}

#Check status of the API
@app.get("/status")
async def status():
    try:
        chat_models = await fetch_chat_models()
        return {
            "ok": True,
            "lm_studio_reachable": True,
            "models_available": len(chat_models),
        }
    except Exception:
        return {
            "ok": False,
            "lm_studio_reachable": False,
            "models_available": 0,
        }

@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    #Building payload for the LM Studio via helper fun
    payload = build_chat_payload(req)
    # Generating streaming response
    async def event_generator():
        try:
            timeout = httpx.Timeout(connect=10.0, read=None, write=30.0, pool=None)
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    f"{LM_STUDIO_BASE}/v1/chat/completions",
                    json=payload,
                ) as response:
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        if not line:
                            continue

                        # LM Studio streams OpenAI-like SSE chunks.
                        if line.startswith("data:"):
                            data_str = line[5:].strip()
                        else:
                            data_str = line.strip()

                        if data_str == "[DONE]":
                            yield "data: [DONE]\n\n"
                            return

                        # Extract delta content
                        delta = extract_delta_content(data_str)

                        if delta:
                            yield f"data: {json.dumps({'delta': delta})}\n\n"

        except Exception as error:
            yield f"event: error\ndata: {json.dumps({'error': str(error)})}\n\n"
    # Returning stream
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
