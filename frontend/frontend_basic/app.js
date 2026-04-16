const promptEl = document.getElementById("prompt");
const chatEl = document.getElementById("chatMessages");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const newChatBtn = document.getElementById("newChatBtn");
const settings = {
  model: "bielik-minitron-7b-v3.0-instruct", // default model
  temperature: 0.7,
  max_tokens: 1024,
};

let conversationHistory = [];


let typingNode = null;      // reference to "..." bubble during generation

function roleClass(role){
  if (role === "user") return "user";
  if (role === "assistant") return "assistant";
  if (role === "system") return "system";
  return "assistant";
}
async function loadModels(modelSelect) {
  modelSelect.disabled = true;
  modelSelect.innerHTML = `<option>Loading...</option>`;

  try {
    const res = await fetch("http://127.0.0.1:8000/api/models");
    if (!res.ok) throw new Error(await res.text());

    const { models } = await res.json();

    if (!models || models.length === 0) {
      modelSelect.innerHTML = `<option>No chat models</option>`;
      return;
    }

    const prev = settings.model;

    modelSelect.innerHTML = models
      .map((id) => `<option value="${id}">${id}</option>`)
      .join("");

    if (models.includes(prev)) {
      modelSelect.value = prev;
    } else {
      settings.model = models[0];
      modelSelect.value = settings.model;
    }
  } catch (err) {
    modelSelect.innerHTML = `<option>Failed to load models</option>`;
    errorEl.textContent = err?.message || "Could not load models";
  } finally {
    modelSelect.disabled = false;
  }
}

function addBubble(role, content){
  const side = roleClass(role);

  const row = document.createElement("div");
  row.className = `msg msg-${side}`;

  const bubble = document.createElement("div");
  bubble.className = `bubble bubble-${side}`;
  bubble.textContent = content;

  row.appendChild(bubble);
  chatEl.appendChild(row);

  // autoscroll
  chatEl.scrollTop = chatEl.scrollHeight;
  return bubble; // <- ważne
}

function showTyping(){
  // only on the assistant side
  const row = document.createElement("div");
  row.className = "msg msg-assistant";

  const bubble = document.createElement("div");
  bubble.className = "bubble bubble-assistant typing";
  bubble.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;

  row.appendChild(bubble);
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;

  typingNode = row;
}

function hideTyping(){
  if (typingNode){
    typingNode.remove();
    typingNode = null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const modelSelect = document.getElementById("modelSelect");
  const temperatureRange = document.getElementById("temperatureRange");
  const temperatureValue = document.getElementById("temperatureValue");
  const maxTokensInput = document.getElementById("maxTokensInput");
  const resetBtn = document.getElementById("resetSettingsBtn");
  const applyBtn = document.getElementById("applySettingsBtn");
  loadModels(modelSelect);
  temperatureRange.addEventListener("input", () => {
    temperatureValue.textContent = Number(temperatureRange.value).toFixed(1);
  });

  applyBtn.addEventListener("click", () => {
    const prevModel = settings.model;

    settings.model = modelSelect.value;
    settings.temperature = Number(temperatureRange.value);
    settings.max_tokens = Number(maxTokensInput.value);

    // Reset czatu tylko jeśli zmieniłeś model
    if (settings.model !== prevModel) {
      resetConversation();
    }

    // Zamknij offcanvas po Apply
     bootstrap.Offcanvas.getOrCreateInstance(
      document.getElementById("settingsOffcanvas")
    ).hide();

    applyBtn.textContent = "Saved ✓";
    setTimeout(() => (applyBtn.textContent = "Apply"), 800);
});

  resetBtn.addEventListener("click", () => {
    modelSelect.value = "bielik-minitron-7b-v3.0-instruct";
    temperatureRange.value = "0.7";
    temperatureValue.textContent = "0.7";
    maxTokensInput.value = "1024";

    settings.model = modelSelect.value;
    settings.temperature = Number(temperatureRange.value);
    settings.max_tokens = Number(maxTokensInput.value);
  });
});

async function sendPrompt() {
  errorEl.textContent = "";

  const prompt = promptEl.value.trim();
  if (!prompt) return;

  // (optionally) clear input immediately
  promptEl.value = "";

  // Zwykle prompt z UI powinien mieć role="user"
  const userRole = "user";

  // 1) Dodaj do UI i historii
  addBubble(userRole, prompt);
  conversationHistory.push({ role: userRole, content: prompt });

  sendBtn.disabled = true;
  statusEl.textContent = "Generating...";
  showTyping();

  try {
   const res = await fetch("http://127.0.0.1:8000/api/chat/stream", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: conversationHistory,
    model: settings.model,
    temperature: settings.temperature,
    max_tokens: settings.max_tokens,
  }),
});

if (!res.ok) {
  const text = await res.text();
  throw new Error(`HTTP ${res.status}: ${text}`);
}

// streaming
const reader = res.body.getReader();
const decoder = new TextDecoder("utf-8");

let buffer = "";
let assistantBubble = null;
let done = false;

while (!done) {
  const { value, done: doneReading } = await reader.read();
  if (doneReading) break;

  buffer += decoder.decode(value, { stream: true });

  // SSE eventy są rozdzielane pustą linią
  const parts = buffer.split("\n\n");
  buffer = parts.pop(); // reszta na następny chunk

  for (const part of parts) {
    const lines = part.split("\n").map(l => l.trim()).filter(Boolean);

    // obsługa event: error (opcjonalnie)
    if (lines[0]?.startsWith("event: error")) {
      const dataLine = lines.find(l => l.startsWith("data:"));
      if (dataLine) {
        const payload = JSON.parse(dataLine.slice(5).trim());
        throw new Error(payload.error || "Stream error");
      }
    }

    const dataLine = lines.find(l => l.startsWith("data:"));
    if (!dataLine) continue;

    const data = dataLine.slice(5).trim();
    if (data === "[DONE]") {
      done = true;
      break;
    }

    const obj = JSON.parse(data); // { delta: "..." }
    const delta = obj.delta || "";

    if (delta) {
      if (!assistantBubble) {
        hideTyping();
        assistantBubble = addBubble("assistant", "");
      }
      assistantBubble.textContent += delta;
      chatEl.scrollTop = chatEl.scrollHeight;
    }
  }
}

hideTyping();

// dopisz final do historii (żeby kolejne prompty miały kontekst)
if (assistantBubble) {
  conversationHistory.push({ role: "assistant", content: assistantBubble.textContent });
} else {
  // jakby model nic nie wysłał
  conversationHistory.push({ role: "assistant", content: "" });
}
  } catch (err) {
    hideTyping();
    errorEl.textContent = err?.message|| "Unknown error";
  } finally {
    sendBtn.disabled = false;
    statusEl.textContent = "";
  }
}

sendBtn.addEventListener("click", sendPrompt);

clearBtn.addEventListener("click", clearVisibleChat);



newChatBtn.addEventListener("click", () => {
  resetConversation();
});


// Enter sends, Shift+Enter new line
promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendPrompt();
  }
});
function clearVisibleChat() {
  promptEl.value = "";
  errorEl.textContent = "";
  statusEl.textContent = "";
  hideTyping();
  chatEl.innerHTML = "";     // czyści tylko to co widać
  // UWAGA: conversationHistory zostaje nietknięte
}
function resetConversation() {
  clearVisibleChat()
  conversationHistory = [];
}
