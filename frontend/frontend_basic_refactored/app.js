const API_BASE_URL = "http://127.0.0.1:8000";

const promptEl = document.getElementById("prompt");
const chatEl = document.getElementById("chatMessages");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const newChatBtn = document.getElementById("newChatBtn");

const state = {
  settings: {
    model: "bielik-minitron-7b-v3.0-instruct",
    temperature: 0.7,
    maxTokens: 1024,
  },
  conversation: [],
  typingNode: null,
  isGenerating: false,
};

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
    const res = await fetch(`${API_BASE_URL}/api/models`);
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    const models = data.models || [];

    if (models.length === 0) {
      modelSelect.innerHTML = `<option>No chat models</option>`;
      return;
    }

    const prev = state.settings.model;

    modelSelect.innerHTML = models
      .map((id) => `<option value="${id}">${id}</option>`)
      .join("");

    if (models.includes(prev)) {
      modelSelect.value = prev;
    } else {
      state.settings.model = models[0];
      modelSelect.value = state.settings.model;
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
  return bubble;
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "msg msg-assistant";

  const bubble = document.createElement("div");
  bubble.className = "bubble bubble-assistant typing";
  bubble.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;

  row.appendChild(bubble);
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;

  state.typingNode = row;
}

function hideTyping(){
  if (state.typingNode){
    state.typingNode.remove();
    state.typingNode = null;
  }
}

function clearInput() {
  promptEl.value = "";
  promptEl.focus();
}

function clearVisibleChat() {
  errorEl.textContent = "";
  statusEl.textContent = "";
  hideTyping();
  chatEl.innerHTML = "";
}

function resetConversation() {
  clearVisibleChat();
  state.conversation = [];
  clearInput();
}

function startGeneratingState() {
  state.isGenerating = true;
  sendBtn.disabled = true;
  statusEl.textContent = "Generating...";
  showTyping();
}

function stopGeneratingState() {
  state.isGenerating = false;
  sendBtn.disabled = false;
  statusEl.textContent = "";
  hideTyping();
}

function saveSettings() {
  localStorage.setItem("chatSettings", JSON.stringify(state.settings));
}

function loadSavedSettings() {
  const raw = localStorage.getItem("chatSettings");
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    state.settings = {
      ...state.settings,
      ...parsed,
    };
  } catch {
    // ignore broken localStorage data
  }
}
document.addEventListener("DOMContentLoaded", () => {
  const modelSelect = document.getElementById("modelSelect");
  const temperatureRange = document.getElementById("temperatureRange");
  const temperatureValue = document.getElementById("temperatureValue");
  const maxTokensInput = document.getElementById("maxTokensInput");
  const resetBtn = document.getElementById("resetSettingsBtn");
  const applyBtn = document.getElementById("applySettingsBtn");

  loadSavedSettings();

  temperatureRange.value = String(state.settings.temperature);
  temperatureValue.textContent = Number(state.settings.temperature).toFixed(1);
  maxTokensInput.value = String(state.settings.maxTokens);

  loadModels(modelSelect).then(() => {
    modelSelect.value = state.settings.model;
  });

  temperatureRange.addEventListener("input", () => {
    temperatureValue.textContent = Number(temperatureRange.value).toFixed(1);
  });

  applyBtn.addEventListener("click", () => {
    const prevModel = state.settings.model;

    state.settings.model = modelSelect.value;
    state.settings.temperature = Number(temperatureRange.value);
    state.settings.maxTokens = Number(maxTokensInput.value);

    saveSettings();

    if (state.settings.model !== prevModel) {
      resetConversation();
    }

    bootstrap.Offcanvas.getOrCreateInstance(
      document.getElementById("settingsOffcanvas")
    ).hide();

    applyBtn.textContent = "Saved ✓";
    setTimeout(() => {
      applyBtn.textContent = "Apply";
    }, 800);
  });

  resetBtn.addEventListener("click", () => {
    state.settings = {
      model: "bielik-minitron-7b-v3.0-instruct",
      temperature: 0.7,
      maxTokens: 1024,
    };

    modelSelect.value = state.settings.model;
    temperatureRange.value = String(state.settings.temperature);
    temperatureValue.textContent = Number(state.settings.temperature).toFixed(1);
    maxTokensInput.value = String(state.settings.maxTokens);

    saveSettings();
  });
});

async function sendPrompt() {
  if (state.isGenerating) return;

  errorEl.textContent = "";

  const prompt = promptEl.value.trim();
  if (!prompt) return;

  addBubble("user", prompt);
  state.conversation.push({ role: "user", content: prompt });
  promptEl.value = "";

  startGeneratingState();

  let assistantBubble = null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: state.conversation,
        model: state.settings.model,
        temperature: state.settings.temperature,
        max_tokens: state.settings.maxTokens,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";
    let done = false;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      if (doneReading) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop();

      for (const part of parts) {
        const lines = part.split("\n").map((l) => l.trim()).filter(Boolean);

        if (lines[0]?.startsWith("event: error")) {
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (dataLine) {
            const payload = JSON.parse(dataLine.slice(5).trim());
            throw new Error(payload.error || "Stream error");
          }
        }

        const dataLine = lines.find((l) => l.startsWith("data:"));
        if (!dataLine) continue;

        const data = dataLine.slice(5).trim();

        if (data === "[DONE]") {
          done = true;
          break;
        }

        let obj;
        try {
          obj = JSON.parse(data);
        } catch {
          continue;
        }

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

    if (assistantBubble) {
      state.conversation.push({
        role: "assistant",
        content: assistantBubble.textContent,
      });
    } else {
      addBubble("system", "No response from model.");
    }
  } catch (err) {
    errorEl.textContent = err?.message || "Unknown error";
  } finally {
    stopGeneratingState();
  }
}
sendBtn.addEventListener("click", sendPrompt);

clearBtn.addEventListener("click", clearInput);

newChatBtn.addEventListener("click", resetConversation);

promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendPrompt();
  }
});
