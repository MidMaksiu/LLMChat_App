// ============================================================
//  api.js — komunikacja z backendem FastAPI
//  Nic tutaj nie dotyka DOM — zwraca dane lub rzuca błędy.
// ============================================================

import { API_BASE_URL, state, buildRequestMessages } from "./state.js";
import {
  setConnectionStatus,
  appendAssistantDelta,
  finalizeAssistantBubble,
  showTyping,
  hideTyping,
} from "./ui.js";
import { appendAssistantMessage } from "./state.js";

// --- Modele ---

export async function fetchModels() {
  const res = await fetch(`${API_BASE_URL}/api/models`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.models || [];
}

// --- Status backendu ---

export async function loadBackendStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    if (data.ok && data.lm_studio_reachable) {
      setConnectionStatus(true, `Connected (${data.models_available})`);
      return;
    }
    setConnectionStatus(false, "Disconnected");
  } catch {
    setConnectionStatus(false, "Disconnected");
  }
}

export function startStatusPolling() {
  if (state.statusIntervalId) {
    clearInterval(state.statusIntervalId);
  }
  loadBackendStatus();
  state.statusIntervalId = setInterval(loadBackendStatus, 3000);
}

// --- Streaming ---

function buildPayload() {
  return {
    messages: buildRequestMessages(),
    model: state.settings.model,
    temperature: state.settings.temperature,
    max_tokens: state.settings.maxTokens,
  };
}

function parseSsePart(part) {
  const lines = part.split("\n").map((l) => l.trim()).filter(Boolean);

  if (lines[0]?.startsWith("event: error")) {
    const dataLine = lines.find((l) => l.startsWith("data:"));
    if (dataLine) {
      let payload;
      try { payload = JSON.parse(dataLine.slice(5).trim()); }
      catch { throw new Error("Invalid SSE error payload"); }
      throw new Error(payload.error || "Stream error");
    }
  }

  const dataLine = lines.find((l) => l.startsWith("data:"));
  if (!dataLine) return { type: "ignore" };

  const data = dataLine.slice(5).trim();
  if (data === "[DONE]") return { type: "done" };

  let obj;
  try { obj = JSON.parse(data); }
  catch { return { type: "ignore" }; }

  return { type: "delta", delta: obj.delta || "" };
}

export async function streamAssistantResponse() {
  state.abortController = new AbortController();

  const res = await fetch(`${API_BASE_URL}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: state.abortController.signal,
    body: JSON.stringify(buildPayload()),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

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
        if (result.type === "done") { done = true; break; }
        if (result.type === "delta" && result.delta) {
          assistantContent += result.delta;
          assistantBubble = appendAssistantDelta(assistantBubble, assistantContent);
        }
      }
    }
  } finally {
    if (assistantContent.trim().length > 0) {
      appendAssistantMessage(assistantContent);
      finalizeAssistantBubble(assistantBubble, assistantContent);
    }
  }
}
