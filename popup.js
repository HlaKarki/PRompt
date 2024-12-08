// Import the models constant
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

document.addEventListener('DOMContentLoaded', () => {
  const openaiSection = document.getElementById('openai-section');
  const claudeSection = document.getElementById('claude-section');
  const providerRadios = document.getElementsByName('provider');
  const openaiKeyInput = document.getElementById('openai-key');
  const openaiModelSelect = document.getElementById('openai-model');
  const anthropicKeyInput = document.getElementById('anthropic-key');
  const anthropicModelSelect = document.getElementById('anthropic-model');
  const saveButton = document.getElementById('save');
  const statusDiv = document.getElementById('status');

  // Populate model dropdowns
  populateModelSelect(openaiModelSelect, AI_MODELS.openai);
  populateModelSelect(anthropicModelSelect, AI_MODELS.anthropic);

  // Load existing settings
  chrome.storage.local.get(
    ['provider', 'openaiKey', 'openaiModel', 'anthropicKey', 'anthropicModel'],
    (result) => {
      if (result.provider) {
        document.querySelector(`input[value="${result.provider}"]`).checked = true;
      }
      if (result.openaiKey) openaiKeyInput.value = result.openaiKey;
      if (result.openaiModel) openaiModelSelect.value = result.openaiModel;
      if (result.anthropicKey) anthropicKeyInput.value = result.anthropicKey;
      if (result.anthropicModel) anthropicModelSelect.value = result.anthropicModel;
      
      updateSections();
    }
  );

  // Add event listeners for radio buttons
  providerRadios.forEach(radio => {
    radio.addEventListener('change', updateSections);
  });

  function updateSections() {
    const selectedProvider = document.querySelector('input[name="provider"]:checked').value;
    
    openaiSection.classList.toggle('inactive', selectedProvider !== 'openai');
    claudeSection.classList.toggle('inactive', selectedProvider !== 'anthropic');
  }

  function populateModelSelect(select, models) {
    Object.entries(models).forEach(([id, name]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = name;
      select.appendChild(option);
    });
  }

  saveButton.addEventListener('click', () => {
    const provider = document.querySelector('input[name="provider"]:checked').value;
    const openaiKey = openaiKeyInput.value.trim();
    const openaiModel = openaiModelSelect.value;
    const anthropicKey = anthropicKeyInput.value.trim();
    const anthropicModel = anthropicModelSelect.value;

    // Validate required fields based on provider
    if (provider === 'openai' && !openaiKey) {
      showStatus('OpenAI API key is required!', 'error');
      return;
    }
    
    if (provider === 'anthropic' && !anthropicKey) {
      showStatus('Anthropic API key is required!', 'error');
      return;
    }

    chrome.storage.local.set({
      provider,
      openaiKey,
      openaiModel,
      anthropicKey,
      anthropicModel
    }, () => {
      showStatus('Settings saved!', 'success');
    });
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.style.color = type === 'error' ? '#cf222e' : '#1a7f37';
    
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 2000);
  }
});