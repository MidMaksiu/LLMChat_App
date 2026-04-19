// ============================================================
//  chat.js — logika czatu
//  Orkiestruje: state + ui + api przy wysyłaniu wiadomości.
// ============================================================
import { renderHistoryList } from "./history.js";
import { state, appendUserMessage, createNewChat, getActiveChat } from "./state.js";
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

// Generating states

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

// Public actions

export function stopGenerating() {
  if (state.abortController) {
    state.abortController.abort();
  }
}

// Resets the conversation by clearing the visible chat, 
// creating a new chat session in the state, 
// clearing the input field, and re-rendering the chat history list to reflect the new session.
export function resetConversation() {
  clearVisibleChat();
  createNewChat();
  clearInput();
  renderHistoryList();
}

// Handles sending a user prompt. It checks if a generation is already in progress,
// retrieves the prompt value, appends it to the active chat session, 
// updates the UI with the new user message, and initiates the assistant response generation. 
// It also manages the generating state and handles any errors that may occur during the process.

export async function sendPrompt() {
    
    if (state.isGenerating) return;

    //If no active chat exists (e.g., all chats were deleted), create a new one before sending the prompt.
    if (!getActiveChat()) {
        createNewChat();
        renderHistoryList();
    }
    clearError();
    const prompt = getPromptValue();
    if (!prompt) return;

    appendUserMessage(prompt);
    renderHistoryList();
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
