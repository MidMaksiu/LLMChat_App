// ============================================================
//  state.js — single source of truth for whole app
// Export state object and functions that modify it.
// ============================================================

export const API_BASE_URL = "http://127.0.0.1:8000";
export const MAX_HISTORY_LENGTH = 100;

const CONTEXT_WINDOW = 20; // How many recent messages to include in the API request
export const MAX_CHATS = 50; //Maximum number of chat sessions to keep in memory/localStorage. Older chats will be discarded when this limit is exceeded.

export const state = {
  settings: {
    model: "bielik-minitron-7b-v3.0-instruct",
    temperature: 0.7,
    maxTokens: 1024,
  },
  chats: [],
  activeChatId: null,
  typingNode: null,
  isGenerating: false,
  abortController: null,
  statusIntervalId: null,
};

// --- Settings (localStorage) ---
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
    // Ignore parsing errors and keep defaults
  }
}

// --- Conversation Management ---


//Generates a unique ID for each chat session, used to track conversations and messages.
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
// Grabs active chat session based on the activeChatId stored in the state. This allows the app to manage multiple conversations and switch between them seamlessly.
export function getActiveChat() {
  return state.chats.find((c) => c.id === state.activeChatId) || null;
}

// Creates a new chat session with a unique ID and default title. 
// The new chat is added to the beginning of the chats array in the state, 
// and if the total number of chats exceeds the defined maximum, 
// it trims the array to keep only the most recent ones. 
// Finally, it sets the newly created chat as the active chat.

export function createNewChat() {
  const chat = { id: generateId(), title: "New chat", messages: [] };
  state.chats.unshift(chat);
  if (state.chats.length > MAX_CHATS) {
    state.chats = state.chats.slice(0, MAX_CHATS);
  }
  state.activeChatId = chat.id;
  saveChats();
  return chat;
}
// Switches the active chat session by updating the activeChatId in the state. 
// It searches for the chat with the specified ID in the chats array and returns it. 
// If no chat is found with the given ID, it returns null.
export function switchToChat(id) {
  const chat = state.chats.find((c) => c.id === id);
  if (!chat) return null;
  state.activeChatId = id;
  return chat;
}
// Deletes a chat session by filtering out the chat with the specified ID from the chats array in the state. 
// If the deleted chat was the active chat, it updates the activeChatId to the next available chat or sets it to null if no chats remain.
export function deleteChat(id) {
  state.chats = state.chats.filter((c) => c.id !== id);
  if (state.activeChatId === id) {
    state.activeChatId = state.chats[0]?.id || null;
  }
  saveChats();
}

// Appends a user message to the active chat session. 
// It retrieves the active chat using getActiveChat() 
// and adds a new message object with the role "user" and the provided content to the messages array of the active chat.
export function appendUserMessage(content) {
  const chat = getActiveChat();
  if (!chat) return;
  chat.messages.push({ role: "user", content });
  if (chat.messages.length > MAX_HISTORY_LENGTH) {
    chat.messages = chat.messages.slice(-MAX_HISTORY_LENGTH);
  }
  if (chat.title === "New chat") {
    chat.title = content.trim().slice(0, 40) + (content.length > 40 ? "…" : "");
  }
  saveChats();
}
// Appends an assistant message to the active chat session.
export function appendAssistantMessage(content) {
  const chat = getActiveChat();
  if (!chat) return;
  chat.messages.push({ role: "assistant", content });
  if (chat.messages.length > MAX_HISTORY_LENGTH) {
    chat.messages = chat.messages.slice(-MAX_HISTORY_LENGTH);
  }
  saveChats();
}
// Return the most recent messages from the active chat session, limited by the defined CONTEXT_WINDOW.
export function buildRequestMessages() {
  return (getActiveChat()?.messages || []).slice(-CONTEXT_WINDOW);
}

// --- Chats (localStorage) ---
export function saveChats() {
  localStorage.setItem("chatHistory", JSON.stringify({
    chats: state.chats,
    activeChatId: state.activeChatId,
  }));
}

export function loadSavedChats() {
  const raw = localStorage.getItem("chatHistory");
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.chats = parsed.chats || [];
    state.activeChatId = parsed.activeChatId || null;
  } catch {
    // ignorujemy uszkodzone dane
  }
}