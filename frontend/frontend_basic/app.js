const promptEl = document.getElementById("prompt");
const answerEl = document.getElementById("answer");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const settings = {
  model: "bielik-minitron-7b-v3.0-instruct",
  temperature: 0.7,
  max_tokens: 256,
  role: "user", // default role for messages sent from the UI
};

document.addEventListener("DOMContentLoaded", () => {
  const roleSelect = document.getElementById("RoleSelect");
  const modelSelect = document.getElementById("modelSelect");
  const temperatureRange = document.getElementById("temperatureRange");
  const temperatureValue = document.getElementById("temperatureValue");
  const maxTokensInput = document.getElementById("maxTokensInput");
  const resetBtn = document.getElementById("resetSettingsBtn");
  const applyBtn = document.getElementById("applySettingsBtn");

  temperatureRange.addEventListener("input", () => {
    temperatureValue.textContent = Number(temperatureRange.value).toFixed(1);
  });

  applyBtn.addEventListener("click", () => {
    settings.model = modelSelect.value;
    settings.temperature = Number(temperatureRange.value);
    settings.max_tokens = Number(maxTokensInput.value);
    settings.role = roleSelect.value;
    applyBtn.textContent = "Saved ✓";
    setTimeout(() => (applyBtn.textContent = "Apply"), 800);
  });

  resetBtn.addEventListener("click", () => {
    modelSelect.value = "bielik-minitron-7b-v3.0-instruct";
    temperatureRange.value = "0.7";
    temperatureValue.textContent = "0.7";
    maxTokensInput.value = "256";

    settings.model = modelSelect.value;
    settings.temperature = Number(temperatureRange.value);
    settings.max_tokens = Number(maxTokensInput.value);
  });
});

async function sendPrompt() {
  errorEl.textContent = "";
  answerEl.value = "";

  const prompt = promptEl.value.trim();
  if (!prompt) return;

  sendBtn.disabled = true;
  statusEl.textContent = "Generating...";

  try {
    const res = await fetch("http://localhost:8000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: settings.role, content: prompt }],
        model: settings.model,
        temperature: settings.temperature,
        max_tokens: settings.max_tokens,
      }),
    });

    if (!res.ok) {  
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = await res.json(); // { content: "..." }
    answerEl.value = data.content ?? "";
  } catch (err) {
    errorEl.textContent = err?.message || "Unknown error";
  } finally {
    sendBtn.disabled = false;
    statusEl.textContent = "";
  }
}

sendBtn.addEventListener("click", sendPrompt);

clearBtn.addEventListener("click", () => {
  promptEl.value = "";
  answerEl.value = "";
  errorEl.textContent = "";
  statusEl.textContent = "";
});

// Enter wysyła, Shift+Enter nowa linia
promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendPrompt();
  }
});