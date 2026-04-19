// ============================================================
//  main.js — punkt wejścia aplikacji
//  Tylko inicjalizacja i event listenery. Zero logiki biznesowej.
// ============================================================
import { populateChatSettings } from "./chat_settings.js";
import { sendPrompt, stopGenerating, resetConversation } from "./chat.js";
import { initSettings } from "./settings.js";
import { startStatusPolling } from "./api.js";
import { updateActionButtons, clearInput, sendBtn, stopBtn, clearBtn, newChatBtn, promptEl } from "./ui.js";
import { state, loadSavedChats, createNewChat } from "./state.js";
import { renderHistoryList, restoreChatMessages } from "./history.js";

const chatForm = document.getElementById("chatForm");

document.addEventListener("DOMContentLoaded", async () => {

    // Load saved chats and initialize the first chat session if none exist. 
    // This ensures that users can continue previous conversations or start fresh ones seamlessly when they open the app.
    loadSavedChats();

    if (state.chats.length === 0) {
    createNewChat();
    }

    renderHistoryList();
    restoreChatMessages();

    // Initialize marked for markdown rendering in chat bubbles. 
    marked.setOptions({ breaks: true, gfm: true });

    // Button states
    updateActionButtons();

    // Settings initialization - loads saved settings, populates the settings form, and sets up event listeners for user interactions.
    await initSettings();

    // Poll backend status every 3 seconds to update the UI with the current status of the backend (e.g., online/offline, model loading).
    startStatusPolling();

    // --- Event listeners ---

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
