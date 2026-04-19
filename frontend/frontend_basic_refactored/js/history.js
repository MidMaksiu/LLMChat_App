// ============================================================
//  history.js — rendering chat list in sidebar
// ============================================================

import { state, switchToChat, deleteChat } from "./state.js";
import { clearVisibleChat, addBubble, renderMarkdownToHtml } from "./ui.js";

const historyListEl = document.getElementById("historyList");

// Renders the full chat list in the sidebar
export function renderHistoryList() {
  historyListEl.innerHTML = "";

  if (state.chats.length === 0) {
    historyListEl.innerHTML = `<p class="history-empty">No conversations yet</p>`;
    return;
  }

  state.chats.forEach((chat) => {
    const item = document.createElement("div");
    item.className = "history-item" + (chat.id === state.activeChatId ? " active" : "");

    const title = document.createElement("span");
    title.className = "history-item-title";
    title.textContent = chat.title;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "history-item-delete";
    deleteBtn.textContent = "✕";
    deleteBtn.title = "Delete chat";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteChat(chat.id);
      renderHistoryList();
      if (state.activeChatId) {
        restoreChatMessages();
      } else {
        clearVisibleChat();
      }
    });

    item.appendChild(title);
    item.appendChild(deleteBtn);
    item.addEventListener("click", () => {
      if (chat.id === state.activeChatId) return;
      switchToChat(chat.id);
      renderHistoryList();
      restoreChatMessages();
    });

    historyListEl.appendChild(item);
  });
}

// Restores messages of the active chat into the chat window
export function restoreChatMessages() {
  clearVisibleChat();
  const chat = state.chats.find((c) => c.id === state.activeChatId);
  if (!chat) return;

  chat.messages.forEach((msg) => {
    if (msg.role === "system") return;
    const bubble = addBubble(msg.role, "");
    if (msg.role === "assistant") {
      bubble.classList.add("bubble-markdown");
      bubble.innerHTML = renderMarkdownToHtml(msg.content);
    } else {
      bubble.textContent = msg.content;
    }
  });
}