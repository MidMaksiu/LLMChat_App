const API_BASE_URL = "http://127.0.0.1:8000";

const promptEl = document.getElementById("prompt");
const chatEl = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const sendBtn = document.getElementById("sendBtn");
const stopBtn = document.getElementById("stopBtn");
const clearBtn = document.getElementById("clearBtn");
const activityStatusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const newChatBtn = document.getElementById("newChatBtn");
const connectionStatusEl = document.getElementById("connectionStatus");
const connectionStatusTextEl = document.getElementById("connectionStatusText");


const state = {
  settings: {
    model: "bielik-minitron-7b-v3.0-instruct",
    temperature: 0.7,
    maxTokens: 1024,
  },
  conversation: [],
  typingNode: null,
  isGenerating: false,
  abortController: null,
  statusIntervalId: null,
};

function updateActionButtons() {
  sendBtn.hidden = state.isGenerating;
  stopBtn.hidden = !state.isGenerating;
}
function finalizeAssistantBubble(bubble, content) {
  if (!bubble) return;

  bubble.classList.add("bubble-markdown");
  bubble.innerHTML = renderMarkdownToHtml(content);
}

function renderMarkdownToHtml(text) {
  if (!text) return "";

  const rawHTML = marked.parse(text, {
    breaks: true,
    gfm: true,
  });
  return DOMPurify.sanitize(rawHTML);
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
  const side = role === "user" ? "user" :
             role === "system" ? "system" :
             "assistant";

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
function setActivityStatus(message) {
  activityStatusEl.textContent = message;
}

function clearVisibleChat() {
  errorEl.textContent = "";
  setActivityStatus("");
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
  setActivityStatus("Generating...");
  showTyping();
  updateActionButtons();
}

function stopGeneratingState() {
  state.isGenerating = false;
  state.abortController = null;
  setActivityStatus("");
  hideTyping();
  updateActionButtons();
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
function stopGenerating() {
  if (state.abortController) {
    state.abortController.abort();
  }
}

function setConnectionStatus(connected, label) {
  connectionStatusEl.classList.toggle("connected", connected);
  connectionStatusEl.classList.toggle("disconnected", !connected);
  connectionStatusTextEl.textContent = label;
}
async function loadBackendStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/status`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data.ok && data.lm_studio_reachable) {
      setConnectionStatus(true, `Connected  (${data.models_available})`);
      return;
    }

    setConnectionStatus(false, "Disconnected");
  } catch {
    setConnectionStatus(false, "Disconnected");
  }
}
function startStatusPolling() {
  if (state.statusIntervalId) {
    clearInterval(state.statusIntervalId);
  }

  loadBackendStatus();
  state.statusIntervalId = setInterval(() => {
    loadBackendStatus();
  }, 3000);
}

document.addEventListener("DOMContentLoaded", () => {
  const modelSelect = document.getElementById("modelSelect");
  const temperatureRange = document.getElementById("temperatureRange");
  const temperatureValue = document.getElementById("temperatureValue");
  const maxTokensInput = document.getElementById("maxTokensInput");
  const resetBtn = document.getElementById("resetSettingsBtn");
  const applyBtn = document.getElementById("applySettingsBtn");


  marked.setOptions({
    breaks: true,
    gfm: true,
  });
  updateActionButtons();
  loadSavedSettings();
  startStatusPolling();


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

  const nextModel = modelSelect.value;
  const nextTemperature = Number(temperatureRange.value);
  const nextMaxTokens = Number(maxTokensInput.value);

  const hasChanges =
    state.settings.model !== nextModel ||
    state.settings.temperature !== nextTemperature ||
    state.settings.maxTokens !== nextMaxTokens;

  state.settings.model = nextModel;
  state.settings.temperature = nextTemperature;
  state.settings.maxTokens = nextMaxTokens;

  if (hasChanges) {
    saveSettings();
  }

  const settingsOffcanvasEl = document.getElementById("settingsOffcanvas");
  const settingsOffcanvas =
    bootstrap.Offcanvas.getInstance(settingsOffcanvasEl) ||
    bootstrap.Offcanvas.getOrCreateInstance(settingsOffcanvasEl);

  settingsOffcanvas.hide();

  if (hasChanges) {
    applyBtn.textContent = "Saved ✓";
    setTimeout(() => {
      applyBtn.textContent = "Apply";
    }, 800);
  } else {
    applyBtn.textContent = "Apply";
  }

  if (nextModel !== prevModel) {
    resetConversation();
  }
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

function getPromptValue() {
  return promptEl.value.trim();
}

function appendUserMessage(prompt) {
  addBubble("user", prompt);
  state.conversation.push({ role: "user", content: prompt });
}

function buildChatRequestBody() {
  return {
    messages: state.conversation,
    model: state.settings.model,
    temperature: state.settings.temperature,
    max_tokens: state.settings.maxTokens,
  };
}

async function createChatStreamRequest() {
  state.abortController = new AbortController();

  const res = await fetch(`${API_BASE_URL}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: state.abortController.signal,
    body: JSON.stringify(buildChatRequestBody()),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res;
}
function appendAssistantMessageToHistory(content) {
  state.conversation.push({
    role: "assistant",
    content,
  });
}

function handleSendPromptError(err) {
  if (err.name === "AbortError") {
    const message = "Generation stopped.";
    addBubble("system", message);
  } else {
    errorEl.textContent = err?.message || "Unknown error";
  }
}
function parseSsePart(part) {
  const lines = part.split("\n").map((l) => l.trim()).filter(Boolean);

  if (lines[0]?.startsWith("event: error")) {
    const dataLine = lines.find((l) => l.startsWith("data:"));
    if (dataLine) {
      let payload;
      try {
        payload = JSON.parse(dataLine.slice(5).trim());
      } catch {
        throw new Error("Invalid SSE error payload");
      }
      throw new Error(payload.error || "Stream error");
    }
  }

  const dataLine = lines.find((l) => l.startsWith("data:"));
  if (!dataLine) {
    return { type: "ignore" };
  }

  const data = dataLine.slice(5).trim();

  if (data === "[DONE]") {
    return { type: "done" };
  }

  let obj;
  try {
    obj = JSON.parse(data);
  } catch {
    return { type: "ignore" };
  }

  return {
    type: "delta",
    delta: obj.delta || "",
  };
}

async function streamAssistantResponse() {
  const res = await createChatStreamRequest();

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let buffer = "";
  let done = false;
  let assistantBubble = null;
  let assistantContent = "";

  try {
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      if (doneReading) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop();

      for (const part of parts) {
        const result = parseSsePart(part);

        if (result.type === "ignore") continue;

        if (result.type === "done") {
          done = true;
          break;
        }

        if (result.type === "delta" && result.delta) {
          assistantContent += result.delta;
          assistantBubble = appendAssistantDelta(assistantBubble, assistantContent);
        }
      }
    }
  } finally {
    if (assistantContent.trim().length > 0) {
      appendAssistantMessageToHistory(assistantContent);
      finalizeAssistantBubble(assistantBubble, assistantContent);
    }
  }
}
function appendAssistantDelta(assistantBubble, fullContent) {
  let bubble = assistantBubble;

  if (!bubble) {
    hideTyping();
    bubble = addBubble("assistant", "");
    bubble.classList.add("bubble-markdown");
  }

  bubble.innerHTML = renderMarkdownToHtml(fullContent);
  chatEl.scrollTop = chatEl.scrollHeight;

  return bubble;
}
async function sendPrompt() {
  if (state.isGenerating) return;

  errorEl.textContent = "";

  const prompt = getPromptValue();
  if (!prompt) return;

  appendUserMessage(prompt);
  clearInput();
  startGeneratingState();

  try {
    await streamAssistantResponse();
  } catch (err) {
    handleSendPromptError(err);
  } finally {
    stopGeneratingState();
  }
}


chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendPrompt();
});
stopBtn.addEventListener("click", stopGenerating);

clearBtn.addEventListener("click", clearInput);

newChatBtn.addEventListener("click", resetConversation);

promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});