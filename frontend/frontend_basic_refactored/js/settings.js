// ============================================================
//  settings.js — panel ustawień modelu (offcanvas)
//  Inicjalizuje kontrolki i obsługuje Apply / Reset.
// ============================================================

import { state, saveSettings, loadSavedSettings } from "./state.js";
import { fetchModels } from "./api.js";
import { resetConversation } from "./chat.js";
import { showError } from "./ui.js";

export async function initSettings() {
    const modelSelect = document.getElementById("modelSelect");
    const temperatureRange = document.getElementById("temperatureRange");
    const temperatureValue = document.getElementById("temperatureValue");
    const maxTokensInput = document.getElementById("maxTokensInput");
    const resetBtn = document.getElementById("resetSettingsBtn");
    const applyBtn = document.getElementById("applySettingsBtn");


    const settingsOffcanvasEl = document.getElementById("settingsOffcanvas");

    settingsOffcanvasEl.addEventListener("hide.bs.offcanvas", (e) => {
        const maxTokensVal = Number(maxTokensInput.value);
        if (!maxTokensVal || maxTokensVal < 1 || maxTokensVal > 4096) {
        e.preventDefault(); // zablokuj zamknięcie
        maxTokensInput.classList.add("is-invalid");
        maxTokensInput.focus();
        }
    });
    maxTokensInput.addEventListener("input", () => {
        maxTokensInput.classList.remove("is-invalid");
    });
  // Load saved settings and populate controls
  loadSavedSettings();
  temperatureRange.value = String(state.settings.temperature);
  temperatureValue.textContent = Number(state.settings.temperature).toFixed(1);
  maxTokensInput.value = String(state.settings.maxTokens);

  // Load models from backend
  await loadModelsIntoSelect(modelSelect);
  
  // Live preview temperatury
  temperatureRange.addEventListener("input", () => {
    temperatureValue.textContent = Number(temperatureRange.value).toFixed(1);
  });

  // Apply
  applyBtn.addEventListener("click", () => {

    const prevModel      = state.settings.model;
    const nextModel      = modelSelect.value;
    const nextTemperature = Number(temperatureRange.value);
    const nextMaxTokens  = Number(maxTokensInput.value);

    const hasChanges =
      state.settings.model !== nextModel      ||
      state.settings.temperature !== nextTemperature ||
      state.settings.maxTokens !== nextMaxTokens;

    state.settings.model = nextModel;
    state.settings.temperature = nextTemperature;
    state.settings.maxTokens = nextMaxTokens;

    if (hasChanges) saveSettings();

    // Close offcanvas
    const el = document.getElementById("settingsOffcanvas");
    const offcanvas = bootstrap.Offcanvas.getInstance(el)
                   || bootstrap.Offcanvas.getOrCreateInstance(el);
    offcanvas.hide();

    if (hasChanges) {
      applyBtn.textContent = "Saved ✓";
      setTimeout(() => { applyBtn.textContent = "Apply"; }, 800);
    }

    // Change of model may require resetting the conversation to avoid context issues, 
    // changes in temperature or max tokens can be applied immediately without resetting.
    if (nextModel !== prevModel) resetConversation();
  });

  // Reset to default settings
  resetBtn.addEventListener("click", () => {

  //Set default model to the first available one from the select options, or a hardcoded fallback if none are available.
  const firstAvailableModel = modelSelect.options[0]?.value || "bielik-minitron-7b-v3.0-instruct";
  state.settings = {
    model: firstAvailableModel,
    temperature: 0.7,
    maxTokens: 1024,
  };

    //Remove error if existing, update controls to reflect default settings, and save them.
    maxTokensInput.classList.remove("is-invalid");
    modelSelect.value = state.settings.model;
    temperatureRange.value = String(state.settings.temperature);
    temperatureValue.textContent = Number(state.settings.temperature).toFixed(1);
    maxTokensInput.value = String(state.settings.maxTokens);

    saveSettings();
  });
}


async function loadModelsIntoSelect(modelSelect) {
  modelSelect.disabled = true;
  modelSelect.innerHTML = `<option>Loading...</option>`;

  try {
    const models = await fetchModels();

    if (models.length === 0) {
      modelSelect.innerHTML = `<option>No chat models</option>`;
      return;
    }

    const prev = state.settings.model;
    modelSelect.innerHTML = models
      .map((id) => `<option value="${id}">${id}</option>`)
      .join("");

    modelSelect.value = models.includes(prev) ? prev : models[0];
    if (!models.includes(prev)) state.settings.model = models[0];

  } catch (err) {
    modelSelect.innerHTML = `<option>Failed to load models</option>`;
    showError(err?.message || "Could not load models");
  } finally {
    modelSelect.disabled = false;
  }
}
