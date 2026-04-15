from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Literal, Optional
from fastapi.middleware.cors import CORSMiddleware
import httpx

LM_STUDIO_BASE = "http://localhost:1234"
MODEL = "bielik-minitron-7b-v3.0-instruct"

app = FastAPI()

origins = [
    "http://localhost:3000",  #VS CODE LIVE PREVIEW
    "http://127.0.0.1:3000",
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
    max_tokens: int = 256
    model: Optional[str] = None  # pozwala nadpisać MODEL z requestu

class ChatResponse(BaseModel):
    content: str

@app.get("/status")
def status():
    return {"ok!": True}

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    payload = {
        # Model name
        "model": req.model or MODEL, #Model name
        # User prompt
        "messages": [m.model_dump() for m in req.messages],
        # Temperature parameter for the model
        "temperature": req.temperature,
        # Token limit
        "max_tokens": req.max_tokens,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
            # Timeout so the request doesn't hang forever if LM Studio stalls
            # Request from backend
            r = await client.post(f"{LM_STUDIO_BASE}/v1/chat/completions", json=payload)

            # Raises an exception for 4xx/5xx so we don't parse an error response as success
            r.raise_for_status()

            # Parse LMStudio response body
            data = r.json()

            # Extract Model response
            content = data["choices"][0]["message"]["content"]
            return {"content": content}
        #Catch errors
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"LM Studio unreachable: {e}")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"LM Studio error: {e.response.text}")
    except (KeyError, IndexError) as e:
        raise HTTPException(status_code=500, detail=f"Unexpected response format: {e}")