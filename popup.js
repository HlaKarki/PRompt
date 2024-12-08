// popup.js
// Models configuration
const AI_MODELS = {
  openai: {
    "gpt-4": "GPT-4 (Most capable & Most Expensive)",
    "gpt-4-turbo-preview": "GPT-4 Turbo (Faster)",
    "gpt-3.5-turbo": "GPT-3.5 (Fastest & Cheapest)",
  },
  anthropic: {
    "claude-3-opus-latest": "Claude-3 Opus (Most powerful & Most Expensive)",
    "claude-3-5-sonnet-latest": "Claude-3.5 Sonnet (Most intelligent)",
    "claude-3-5-haiku-latest": "Claude-3.5 Haiku (Fastest & Cheapest)",
  },
};

document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll(".provider-section");
  const openaiKeyInput = document.getElementById("openai-key");
  const openaiModelSelect = document.getElementById("openai-model");
  const anthropicKeyInput = document.getElementById("anthropic-key");
  const anthropicModelSelect = document.getElementById("anthropic-model");
  const saveButton = document.getElementById("save");
  const statusDiv = document.getElementById("status");

  // Populate model dropdowns
  populateModelSelect(openaiModelSelect, AI_MODELS.openai);
  populateModelSelect(anthropicModelSelect, AI_MODELS.anthropic);

  // Load existing settings
  // Load existing settings
  if (chrome.storage) {  // Add this check
    chrome.storage.local.get(
        ["provider", "openaiKey", "openaiModel", "anthropicKey", "anthropicModel"],
        (result) => {
          if (result.provider) {
            document.querySelector(`input[value="${result.provider}"]`).checked = true;
            updateActiveSections(result.provider);
          }
          if (result.openaiKey) openaiKeyInput.value = result.openaiKey;
          if (result.openaiModel) openaiModelSelect.value = result.openaiModel;
          if (result.anthropicKey) anthropicKeyInput.value = result.anthropicKey;
          if (result.anthropicModel) anthropicModelSelect.value = result.anthropicModel;
        }
    );
  }

  // Add click handlers for sections
  sections.forEach((section) => {
    section.addEventListener("click", (e) => {
      // Prevent triggering when clicking form elements
      if (
          e.target.tagName === "INPUT" ||
          e.target.tagName === "SELECT" ||
          e.target.tagName === "OPTION" ||
          e.target.tagName === "LABEL"
      ) {
        return;
      }

      const provider = section.dataset.provider;
      const radio = section.querySelector('input[type="radio"]');

      if (radio) {
        radio.checked = true;
        updateActiveSections(provider);
      }
    });

    // Handle keyboard navigation
    section.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const radio = section.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          updateActiveSections(section.dataset.provider);
        }
      }
    });
  });

  // Also handle radio button changes directly
  document.querySelectorAll('input[name="provider"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      updateActiveSections(e.target.value);
    });
  });

  function updateActiveSections(activeProvider) {
    sections.forEach(section => {
      const isActive = section.dataset.provider === activeProvider;
      section.classList.toggle("active", isActive);

      // Enable/disable inputs based on active section
      const inputs = section.querySelectorAll("input:not([type='radio']), select");
      inputs.forEach(input => {
        input.disabled = !isActive;
      });
    });
  }

  function populateModelSelect(select, models) {
    select.innerHTML = Object.entries(models)
        .map(([id, name]) => `<option value="${id}">${name}</option>`)
        .join("");
  }

  saveButton.addEventListener("click", () => {
    const provider = document.querySelector('input[name="provider"]:checked').value;
    const openaiKey = openaiKeyInput.value.trim();
    const openaiModel = openaiModelSelect.value;
    const anthropicKey = anthropicKeyInput.value.trim();
    const anthropicModel = anthropicModelSelect.value;

    if (provider === "openai" && !openaiKey) {
      showStatus("OpenAI API key is required!", "error");
      return;
    }

    if (provider === "anthropic" && !anthropicKey) {
      showStatus("Anthropic API key is required!", "error");
      return;
    }

    chrome.storage.local.set(
        {
          provider,
          openaiKey,
          openaiModel,
          anthropicKey,
          anthropicModel,
        },
        () => {
          if (chrome.runtime.lastError) {
            showStatus(
                "Error saving settings: " + chrome.runtime.lastError.message,
                "error"
            );
          } else {
            showStatus("Settings saved successfully!", "success");
          }
        }
    );
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status visible ${type}`;
    setTimeout(() => {
      statusDiv.className = "status";
    }, 2000);
  }
});