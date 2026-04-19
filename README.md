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
 ```
 Or you can use Live preview option in vscode
 index.html -> Show preview -> Open in external browser (Should open on port 3000 or 3001)

4. If there is problem with ports open main.py and add to origins localhost with your index.html adress"
```python
origins = [
  "http://localhost:3000",  #My Python server
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",  #My VS CODE LIVE PREVIEW
  "http://localhost:3001",
 ]
```
   
5. Open in browser:
   http://localhost:3000 / http://localhost:3001
6. Enter prompts and enjoy.