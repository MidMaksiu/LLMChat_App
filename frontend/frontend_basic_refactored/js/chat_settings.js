// ============================================================
//  chat_settings.js - Handles chat-specific settings like title and system prompt.
// ============================================================

import { state, updateChatSettings, getActiveChat } from "./state.js";
import { renderHistoryList } from "./history.js";

const chatTitleInput         = document.getElementById("chatTitleInput");
const chatSystemPromptInput  = document.getElementById("chatSystemPromptInput");
const saveChatSettingsBtn    = document.getElementById("saveChatSettingsBtn");
const settingsOffcanvasEl    = document.getElementById("settingsOffcanvas");

// Fills the chat settings form with the active chat's current title and system prompt.
function populateChatSettings() {
  const chat = getActiveChat();
  if (!chat) {
    chatTitleInput.value          = "";
    chatSystemPromptInput.value   = "";
    return;
  }
  chatTitleInput.value         = chat.title === "New chat" ? "" : chat.title;
  chatSystemPromptInput.value  = chat.systemPrompt || "";
}
// Saving chat settingsate.
saveChatSettingsBtn.addEventListener("click", () => {
  const chat = getActiveChat();
  if (!chat) return;

  const newTitle        = chatTitleInput.value.trim();
  const newSystemPrompt = chatSystemPromptInput.value.trim();

  updateChatSettings(chat.id, {
    title:        newTitle || "New chat",
    systemPrompt: newSystemPrompt,
  });
  renderHistoryList();
  const offcanvas = bootstrap.Offcanvas.getInstance(settingsOffcanvasEl)
               || bootstrap.Offcanvas.getOrCreateInstance(settingsOffcanvasEl);
  offcanvas.hide();
});

settingsOffcanvasEl.addEventListener("show.bs.offcanvas", () => {
  populateChatSettings();
});

export { populateChatSettings };