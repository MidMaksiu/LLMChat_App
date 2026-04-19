// ============================================================
//  ui.js — wszystko co dotyka DOM
//  Funkcje renderujące bąbelki, typing indicator, statusy.
// ============================================================

import { state } from "./state.js";

// --- Referencje do elementów DOM ---

export const promptEl    = document.getElementById("prompt");
export const chatEl      = document.getElementById("chatMessages");
export const sendBtn     = document.getElementById("sendBtn");
export const stopBtn     = document.getElementById("stopBtn");
export const clearBtn    = document.getElementById("clearBtn");
export const newChatBtn  = document.getElementById("newChatBtn");
export const errorEl     = document.getElementById("error");

const activityStatusEl      = document.getElementById("status");
const connectionStatusEl    = document.getElementById("connectionStatus");
const connectionStatusTextEl = document.getElementById("connectionStatusText");

// --- Markdown ---

export function renderMarkdownToHtml(text) {
  if (!text) return "";
  const rawHTML = marked.parse(text, { breaks: true, gfm: true });
  return DOMPurify.sanitize(rawHTML);
}

// --- Bąbelki ---

export function addBubble(role, content) {
  const side = role === "user" ? "user"
             : role === "system" ? "system"
             : "assistant";

  const row = document.createElement("div");
  row.className = `msg msg-${side}`;

  const bubble = document.createElement("div");
  bubble.className = `bubble bubble-${side}`;
  bubble.textContent = content;

  row.appendChild(bubble);
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;

  return bubble;
}

export function finalizeAssistantBubble(bubble, content) {
  if (!bubble) return;
  bubble.classList.add("bubble-markdown");
  bubble.innerHTML = renderMarkdownToHtml(content);
}

export function appendAssistantDelta(existingBubble, fullContent) {
  let bubble = existingBubble;

  if (!bubble) {
    hideTyping();
    bubble = addBubble("assistant", "");
    bubble.classList.add("bubble-markdown");
  }

  bubble.innerHTML = renderMarkdownToHtml(fullContent);
  chatEl.scrollTop = chatEl.scrollHeight;

  return bubble;
}

// --- Typing indicator ---

export function showTyping() {
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

export function hideTyping() {
  if (state.typingNode) {
    state.typingNode.remove();
    state.typingNode = null;
  }
}

// --- Przyciski Send / Stop ---

export function updateActionButtons() {
  sendBtn.hidden = state.isGenerating;
  stopBtn.hidden = !state.isGenerating;
}

// --- Status i błędy ---

export function setActivityStatus(message) {
  activityStatusEl.textContent = message;
}

export function setConnectionStatus(connected, label) {
  connectionStatusEl.classList.toggle("connected", connected);
  connectionStatusEl.classList.toggle("disconnected", !connected);
  connectionStatusTextEl.textContent = label;
}

export function clearError() {
  errorEl.textContent = "";
}

export function showError(message) {
  errorEl.textContent = message;
}

// --- Input ---

export function clearInput() {
  promptEl.value = "";
  promptEl.focus();
}

export function getPromptValue() {
  return promptEl.value.trim();
}

// --- Czat ---

export function clearVisibleChat() {
  clearError();
  setActivityStatus("");
  hideTyping();
  chatEl.innerHTML = "";
}
