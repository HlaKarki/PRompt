// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const tokenInput = document.getElementById('github-token');
    const openaiInput = document.getElementById('openai-key');
    const modelSelect = document.getElementById('openai-model');
    const saveButton = document.getElementById('save');
    const statusDiv = document.getElementById('status');
  
    // Load existing values
    chrome.storage.local.get(['githubToken', 'openaiKey', 'openaiModel'], (result) => {
      if (result.githubToken) tokenInput.value = result.githubToken;
      if (result.openaiKey) openaiInput.value = result.openaiKey;
      if (result.openaiModel) modelSelect.value = result.openaiModel;
    });
  
    saveButton.addEventListener('click', () => {
      const githubToken = tokenInput.value.trim();
      const openaiKey = openaiInput.value.trim();
      const openaiModel = modelSelect.value;
      
      if (!openaiKey) {
        statusDiv.textContent = 'OpenAI API key is required!';
        statusDiv.style.color = '#cf222e';
        return;
      }
      
      chrome.storage.local.set({
        githubToken,
        openaiKey,
        openaiModel
      }, () => {
        statusDiv.textContent = 'Settings saved!';
        statusDiv.style.color = '#1a7f37';
        
        setTimeout(() => {
          statusDiv.textContent = '';
        }, 2000);
      });
    });
  });