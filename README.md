# LLMChat_App

A chat-like app to communicate with locally started models using **LM Studio**.  
Made out of curiosity because I'm currently enrolled in an AI project at my university.

## Features to Add
- Conversation History
- Document Data bases
- Streaming
## Project structure
- **/frontend_basic** — HTML/CSS + vanilla JS chat UI (Bootstrap)
- **/backend** — FastAPI proxy for sending messages to LM Studio and receiving responses

## How to launch

1. Start LM Studio load model and enable the **API Server** (LM Studio API), usually on:
   - `http://localhost:1234`

2. Start the backend:
   ```bash
   cd backend
   python -m uvicorn main:app --reload --port 8000
   
3. Start the frontend (static server):
    ```bash
    cd frontend_basic
    python -m http.server 3000
4. Open in browser:
   http://localhost:3000
5. Enter prompts and enjoy.