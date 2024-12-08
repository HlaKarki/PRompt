// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "makeAPICall") {
    makeAPICall(request.data)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true; // Will respond asynchronously
  }
});

async function makeAPICall(data) {
  const { provider, apiKey, model, prompt } = data;

  if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
        },
      body: JSON.stringify({
        model: model,
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        system:
          "You are a helpful assistant specialized in writing clear and comprehensive GitHub pull request descriptions.",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Claude API request failed");
    }

    return await response.json();
  } else if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "OpenAI API request failed");
    }

    return await response.json();
  }

  throw new Error("Invalid provider specified");
}
