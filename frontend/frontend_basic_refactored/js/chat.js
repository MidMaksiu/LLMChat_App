// ============================================================
//  chat.js — logika czatu
//  Orkiestruje: state + ui + api przy wysyłaniu wiadomości.
// ============================================================

import { state, appendUserMessage, clearConversation } from "./state.js";
import {
  addBubble,
  updateActionButtons,
  setActivityStatus,
  showTyping,
  hideTyping,
  clearVisibleChat,
  clearInput,
  clearError,
  showError,
  getPromptValue,
} from "./ui.js";
import { streamAssistantResponse } from "./api.js";

// --- Stany generowania ---

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

// --- Akcje publiczne ---

export function stopGenerating() {
  if (state.abortController) {
    state.abortController.abort();
  }
}

export function resetConversation() {
  clearVisibleChat();
  clearConversation();
  clearInput();
}

export async function sendPrompt() {
  if (state.isGenerating) return;

  clearError();
  const prompt = getPromptValue();
  if (!prompt) return;

  appendUserMessage(prompt);
  addBubble("user", prompt);
  clearInput();
  startGeneratingState();

  try {
    await streamAssistantResponse();
  } catch (err) {
    if (err.name === "AbortError") {
      addBubble("system", "Generation stopped.");
    } else {
      showError(err?.message || "Unknown error");
    }
  } finally {
    stopGeneratingState();
  }
}
