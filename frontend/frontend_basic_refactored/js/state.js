// ============================================================
//  state.js — single source of truth dla całej aplikacji
//  Eksportuje obiekt state i funkcje które go modyfikują.
// ============================================================

export const API_BASE_URL = "http://127.0.0.1:8000";
export const MAX_HISTORY_LENGTH = 100;
const CONTEXT_WINDOW = 20; // ile ostatnich wiadomości wysyłamy do modelu

export const state = {
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

// --- Ustawienia (localStorage) ---

export function saveSettings() {
  localStorage.setItem("chatSettings", JSON.stringify(state.settings));
}

export function loadSavedSettings() {
  const raw = localStorage.getItem("chatSettings");
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.settings = { ...state.settings, ...parsed };
  } catch {
    // ignorujemy uszkodzone dane
  }
}

// --- Konwersacja ---

export function appendUserMessage(content) {
  state.conversation.push({ role: "user", content });
  if (state.conversation.length > MAX_HISTORY_LENGTH) {
    state.conversation = state.conversation.slice(-MAX_HISTORY_LENGTH);
  }
}

export function appendAssistantMessage(content) {
  state.conversation.push({ role: "assistant", content });
  if (state.conversation.length > MAX_HISTORY_LENGTH) {
    state.conversation = state.conversation.slice(-MAX_HISTORY_LENGTH);
  }
}

export function clearConversation() {
  state.conversation = [];
}

export function buildRequestMessages() {
  return state.conversation.slice(-CONTEXT_WINDOW);
}
