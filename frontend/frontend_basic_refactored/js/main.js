// ============================================================
//  main.js — punkt wejścia aplikacji
//  Tylko inicjalizacja i event listenery. Zero logiki biznesowej.
// ============================================================

import { sendPrompt, stopGenerating, resetConversation } from "./chat.js";
import { initSettings } from "./settings.js";
import { startStatusPolling } from "./api.js";
import { updateActionButtons, clearInput, sendBtn, stopBtn, clearBtn, newChatBtn, promptEl } from "./ui.js";

const chatForm = document.getElementById("chatForm");

document.addEventListener("DOMContentLoaded", async () => {
  // Inicjalizacja marked (biblioteka globalna z CDN)
  marked.setOptions({ breaks: true, gfm: true });

  // Stan przycisków
  updateActionButtons();

  // Panel ustawień
  await initSettings();

  // Polling statusu backendu
  startStatusPolling();

  // --- Event listenery ---

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
});
