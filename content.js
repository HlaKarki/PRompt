// content.js
console.log("PR Description Generator Extension loaded!");

// Utility functions
const AI_MODELS = {
  openai: {
    "gpt-4": "GPT-4 (Most capable)",
    "gpt-4-turbo-preview": "GPT-4 Turbo (Faster)",
    "gpt-3.5-turbo": "GPT-3.5 (Fastest)",
  },
  anthropic: {
    "claude-3-opus-20240229": "Claude-3 Opus (Most capable)",
    "claude-3-sonnet-20240229": "Claude-3 Sonnet (Balanced)",
    "claude-3-haiku-20240307": "Claude-3 Haiku (Fastest)",
  }
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAISettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ["provider", "openaiKey", "openaiModel", "anthropicKey", "anthropicModel"],
      (result) => {
        resolve({
          provider: result.provider || "openai", // default to OpenAI if not set
          openai: {
            apiKey: result.openaiKey,
            model: result.openaiModel || "gpt-3.5-turbo", // default model
          },
          anthropic: {
            apiKey: result.anthropicKey,
            model: result.anthropicModel || "claude-3-haiku-20240307", // default model
          }
        });
      }
    );
  });
}

function getRepoInfo() {
  const [owner, repo] = window.location.pathname
    .split("/")
    .filter(Boolean)
    .slice(0, 2);
  return { owner, repo };
}

function getBranchInfo() {
  const compareMatch = window.location.pathname.match(/compare\/(.+)/);
  if (compareMatch) {
    const [base, head] = compareMatch[1].split("...");
    return { base, head };
  }
  return null;
}

function getPRNumber() {
  const match = window.location.pathname.match(/\/pull\/(\d+)/);
  return match ? match[1] : null;
}

// UI Helper functions
function showError(message, targetElement) {
  const existingError = document.querySelector(".pr-generator-error");
  if (existingError) {
    existingError.remove();
  }

  const errorDiv = document.createElement("div");
  errorDiv.className = "pr-generator-error";
  errorDiv.textContent = message;

  targetElement.parentElement.insertBefore(errorDiv, targetElement.nextSibling);

  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

function showTemplateSelector(templates, targetElement) {
  const existingSelector = document.querySelector(
    ".pr-generator-template-select"
  );
  if (existingSelector) {
    existingSelector.remove();
  }

  const dropdown = document.createElement("select");
  dropdown.className = "pr-generator-template-select";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "-- Select a template --";
  dropdown.appendChild(defaultOption);

  templates.forEach((template) => {
    const option = document.createElement("option");
    option.value = template;
    const templateName = template
      .split("/")
      .pop()
      .replace(".md", "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    option.textContent = templateName;
    dropdown.appendChild(option);
  });

  targetElement.parentElement.insertBefore(dropdown, targetElement);

  return new Promise((resolve) => {
    dropdown.addEventListener("change", () => {
      if (dropdown.value) {
        resolve(dropdown.value);
      }
    });
  });
}

// Data fetching functions
async function fetchCommits() {
  const { owner, repo } = getRepoInfo();
  const { base, head } = getBranchInfo();

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch commits");
    }

    const data = await response.json();
    return data.commits.map((commit) => ({
      message: commit.commit.message,
      sha: commit.sha,
    }));
  } catch (error) {
    console.error("Error fetching commits:", error);
    return [];
  }
}

async function fetchFilesChanged() {
  const { owner, repo } = getRepoInfo();
  const { base, head } = getBranchInfo();

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch file changes");
    }

    const data = await response.json();

    return data.files.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
    }));
  } catch (error) {
    console.error("Error fetching file changes:", error);
    return [];
  }
}

async function fetchLinkedIssues() {
  const commits = await fetchCommits();
  const issueRefs = new Set();

  const keywords = [
    "fixes",
    "fixed",
    "fix",
    "closes",
    "closed",
    "close",
    "resolves",
    "resolved",
    "resolve",
  ];

  commits.forEach((commit) => {
    const message = commit.message.toLowerCase();
    keywords.forEach((keyword) => {
      const regex = new RegExp(`${keyword}\\s+#(\\d+)`, "gi");
      const matches = [...message.matchAll(regex)];
      matches.forEach((match) => issueRefs.add(match[1]));
    });
  });

  const { owner, repo } = getRepoInfo();

  const issues = await Promise.all(
    Array.from(issueRefs).map(async (issueNum) => {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues/${issueNum}`
        );

        if (!response.ok) return null;

        const issue = await response.json();
        return {
          number: issue.number,
          title: issue.title,
          state: issue.state,
          url: issue.html_url,
        };
      } catch (error) {
        console.error(`Error fetching issue #${issueNum}:`, error);
        return null;
      }
    })
  );

  return issues.filter(Boolean);
}

async function getDefaultTemplate() {
  return fetch(chrome.runtime.getURL('default_template.md'))
    .then(response => response.text())
    .catch(error => {
      console.error('Error loading default template:', error);
      return null;
    });
}

async function getPRTemplate() {
  const textArea = document.querySelector("#pull_request_body");
  if (!textArea) {
    throw new Error("Could not find PR description textarea");
  }

  const existingContent = textArea.value.trim();
  const button = document.getElementById("pr-generator-btn");

  try {
    // Case 1: Template selector page
    if (existingContent.includes("?expand=1&template=")) {
      const templateUrls = existingContent.match(
        /\?expand=1&template=[\w_-]+\.md/g
      );

      if (templateUrls && templateUrls.length > 0) {
        const templatePaths = templateUrls.map((url) => {
          const params = new URLSearchParams(url);
          return `.github/PULL_REQUEST_TEMPLATE/${params.get("template")}`;
        });

        const selectedTemplate = await showTemplateSelector(
          templatePaths,
          button
        );

        if (!selectedTemplate) {
          throw new Error("Please select a template");
        }

        const { owner, repo } = getRepoInfo();
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${selectedTemplate}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch template: ${response.statusText}`);
        }

        const data = await response.json();
        return atob(data.content);
      }
    }

    // Case 2: Already loaded template
    if (existingContent && !existingContent.includes("?expand=1&template=")) {
      return existingContent;
    }

    // Case 3: Check common locations
    const { owner, repo } = getRepoInfo();
    const templates = [
      ".github/pull_request_template.md",
      ".github/PULL_REQUEST_TEMPLATE.md",
      "docs/pull_request_template.md",
    ];

    const templatePromises = templates.map((template) =>
      fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${template}`
      )
    );

    const responses = await Promise.all(templatePromises);
    const validResponses = responses.filter((response) => response.ok);

    if (validResponses.length > 0) {
      const selectedTemplate = await showTemplateSelector(templates, button);
      const selectedResponse = responses[templates.indexOf(selectedTemplate)];
      const data = await selectedResponse.json();
      return atob(data.content);
    } else if (validResponses.length === 1) {
      const data = await validResponses[0].json();
      return atob(data.content);
    }

    // Case 4: Use default template if no content and no repo template
    return await getDefaultTemplate();
  } catch (error) {
    showError(error.message, button);
    // Fallback to default template on any error
    return await getDefaultTemplate();
  }
}

// Main functions
async function getPRData() {
  const { owner, repo } = getRepoInfo();
  const { base, head } = getBranchInfo();

  try {
    const [commits, filesChanged, linkedIssues] = await Promise.all([
      fetchCommits(),
      fetchFilesChanged(),
      fetchLinkedIssues(),
    ]);

    return {
      metadata: {
        owner,
        repo,
        base: base || "main",
        head: head || "",
        url: window.location.href,
      },
      commits,
      filesChanged,
      linkedIssues,
    };
  } catch (error) {
    showError("Error fetching PR data: " + error.message);
    throw error;
  }
}

async function getOpenAIKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["openaiKey"], (result) => {
      resolve(result.openaiKey);
    });
  });
}

async function generateWithOpenAI(template, prData) {
  const { apiKey, model } = await getOpenAISettings();
  
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please add it in the extension settings.');
  }

  const prompt = `Generate a comprehensive GitHub pull request description based on the following information:

Template Structure:
${template || 'No template provided - please create a clear, structured description.'}

Pull Request Changes:
- Branch: ${prData.metadata.head} → ${prData.metadata.base}
- Files Changed: ${prData.filesChanged.length}
${prData.filesChanged.map(file => `  • ${file.filename} (${file.status}: +${file.additions} -${file.deletions})`).join('\n')}

Commits:
${prData.commits.map(commit => `- ${commit.message}`).join('\n')}

${prData.linkedIssues.length ? `Linked Issues:
${prData.linkedIssues.map(issue => `- #${issue.number}: ${issue.title}`).join('\n')}` : ''}

Instructions:
1. Follow the template structure if provided
2. Summarize the changes concisely but comprehensively
3. Highlight important changes and their impact
4. Maintain a professional tone
5. Include all relevant issue references
6. Format in clean Markdown without using triple backtick fences
7. Do not add any meta-commentary about the description itself
8. Start directly with the content, usually with a heading like ## Description or # Title

Generate the PR description now:`;

  try {
    const data = await callOpenAIWithRetry(apiKey, model, prompt);
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error(`Failed to generate description: ${error.message}`);
  }
}

async function callOpenAIWithRetry(apiKey, model, prompt, retryCount = 0) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "OpenAI API request failed");
    }

    return await response.json();
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
      console.log(`Retry ${retryCount + 1}/${MAX_RETRIES} after ${delay}ms...`);
      await sleep(delay);
      return callOpenAIWithRetry(apiKey, model, prompt, retryCount + 1);
    }
    throw error;
  }
}

async function generateWithClaude(template, prData) {
  const settings = await getAISettings();
  const { apiKey, model } = settings.anthropic;
  
  if (!apiKey) {
    throw new Error('Anthropic API key not found. Please add it in the extension settings.');
  }

  const prompt = `Generate a comprehensive GitHub pull request description based on the following information:

Template Structure:
${template || 'No template provided - please create a clear, structured description.'}

Pull Request Changes:
- Branch: ${prData.metadata.head} → ${prData.metadata.base}
- Files Changed: ${prData.filesChanged.length}
${prData.filesChanged.map(file => `  • ${file.filename} (${file.status}: +${file.additions} -${file.deletions})`).join('\n')}

Commits:
${prData.commits.map(commit => `- ${commit.message}`).join('\n')}

${prData.linkedIssues.length ? `Linked Issues:
${prData.linkedIssues.map(issue => `- #${issue.number}: ${issue.title}`).join('\n')}` : ''}

Instructions:
1. Follow the template structure if provided
2. Summarize the changes concisely but comprehensively
3. Highlight important changes and their impact
4. Maintain a professional tone
5. Include all relevant issue references
6. Format in clean Markdown without using triple backtick fences
7. Do not add any meta-commentary about the description itself
8. Start directly with the content, usually with a heading like ## Description or # Title

Generate the PR description now:`;

  try {
    const data = await callClaudeWithRetry(apiKey, model, prompt);
    return data.content[0].text;
  } catch (error) {
    console.error('Claude API error:', error);
    throw new Error(`Failed to generate description: ${error.message}`);
  }
}

async function callClaudeWithRetry(apiKey, model, prompt, retryCount = 0) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Claude API request failed");
    }

    return await response.json();
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`Retry ${retryCount + 1}/${MAX_RETRIES} after ${delay}ms...`);
      await sleep(delay);
      return callClaudeWithRetry(apiKey, model, prompt, retryCount + 1);
    }
    throw error;
  }
}

async function generateDescription() {
  const button = document.getElementById('pr-generator-btn');
  const originalText = button.textContent;
  const textArea = document.querySelector('#pull_request_body');
  
  try {
    button.textContent = '🔄 Gathering PR data...';
    button.disabled = true;

    // Clear textarea and show loading message
    textArea.value = 'Generating PR description...\n\nGathering commit information and analyzing changes...';
    textArea.dispatchEvent(new Event('input', { bubbles: true }));

    const [template, prData, settings] = await Promise.all([
      getPRTemplate(),
      getPRData(),
      getAISettings()
    ]);

    button.textContent = '🤖 Generating with AI...';
    textArea.value = 'Crafting description using AI...\n\nAnalyzing changes and formatting content...';
    textArea.dispatchEvent(new Event('input', { bubbles: true }));
    
    let retryCount = 0;
    let generatedDescription;
    
    try {
      if (settings.provider === 'anthropic') {
        generatedDescription = await generateWithClaude(template, prData);
      } else {
        generatedDescription = await generateWithOpenAI(template, prData);
      }
    } catch (error) {
      if (error.message.includes('rate limits')) {
        button.textContent = '🔄 Retrying...';
        retryCount++;
      }
      throw error;
    }
    
    textArea.value = generatedDescription;
    textArea.dispatchEvent(new Event('input', { bubbles: true }));
    
    button.textContent = '✅ Generated!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);

  } catch (error) {
    console.error('Error:', error);
    showError(error.message, button);
    // Clear loading message on error
    if (textArea.value.includes('Generating PR description...')) {
      textArea.value = '';
      textArea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } finally {
    button.disabled = false;
  }
}

function addButton() {
  if (
    !window.location.pathname.includes("/pull/") &&
    !window.location.pathname.includes("/compare/")
  ) {
    return;
  }

  if (document.getElementById("pr-generator-btn")) {
    return;
  }

  const textArea = document.querySelector("#pull_request_body");
  if (!textArea) {
    return;
  }

  const button = document.createElement("button");
  button.id = "pr-generator-btn";
  button.textContent = "🤖 Generate Description";
  button.classList.add("pr-generator-btn");

  button.addEventListener("click", generateDescription);

  textArea.parentElement.insertBefore(button, textArea);
}

// Initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", addButton);
} else {
  addButton();
}

// Watch for navigation changes
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === "childList") {
      addButton();
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
