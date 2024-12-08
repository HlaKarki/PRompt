// content.js
console.log("PR Description Generator Extension loaded!");

// Constants
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
// Invalid Claude model. Available models: claude-3-opus-latest, claude-3-5-sonnet-latest, claude-3-5-haiku-latest

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Utility functions
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAISettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(
            ["provider", "openaiKey", "openaiModel", "anthropicKey", "anthropicModel"],
            (result) => {
                resolve({
                    provider: result.provider || "openai",
                    openai: {
                        apiKey: result.openaiKey,
                        model: result.openaiModel || Object.keys(AI_MODELS.openai)[2],
                    },
                    anthropic: {
                        apiKey: result.anthropicKey,
                        model: result.anthropicModel || Object.keys(AI_MODELS.anthropic)[2],
                    }
                });
            }
        );
    });
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

// Data fetching functions
async function fetchCommits(owner, repo, base, head) {
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

async function fetchFilesChanged(owner, repo, base, head) {
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

async function fetchLinkedIssues(owner, repo, commits) {
    const issueRefs = new Set();
    const keywords = ["fixes", "fixed", "fix", "closes", "closed", "close", "resolves", "resolved", "resolve"];

    commits.forEach((commit) => {
        const message = commit.message.toLowerCase();
        keywords.forEach((keyword) => {
            const regex = new RegExp(`${keyword}\\s+#(\\d+)`, "gi");
            const matches = [...message.matchAll(regex)];
            matches.forEach((match) => issueRefs.add(match[1]));
        });
    });

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

// Path helper functions
function getPathInfo() {
    const path = window.location.pathname;
    const [owner, repo] = path.split("/").filter(Boolean).slice(0, 2);
    const compareMatch = path.match(/compare\/(.+)/);
    const pullMatch = path.match(/\/pull\/(\d+)/);

    return {
        owner,
        repo,
        compare: compareMatch ? compareMatch[1].split("...") : null,
        pullNumber: pullMatch ? pullMatch[1] : null
    };
}

// Template handling
async function getDefaultTemplate() {
    return fetch(chrome.runtime.getURL('/assets/default_template.md'))
        .then(response => response.text())
        .catch(error => {
            console.error('Error loading default template:', error);
            return null;
        });
}

async function getPRTemplate(owner, repo) {
    const textArea = document.querySelector("#pull_request_body");
    if (!textArea) {
        throw new Error("Could not find PR description textarea");
    }

    const existingContent = textArea.value.trim();

    try {
        // Use existing content if available
        if (existingContent && !existingContent.includes("?expand=1&template=")) {
            return existingContent;
        }

        // Check common locations
        const templates = [
            ".github/pull_request_template.md",
            ".github/PULL_REQUEST_TEMPLATE.md",
            "docs/pull_request_template.md",
        ];

        const templatePromises = templates.map((template) =>
            fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${template}`)
        );

        const responses = await Promise.all(templatePromises);
        const validResponse = responses.find(response => response.ok);

        if (validResponse) {
            const data = await validResponse.json();
            return atob(data.content);
        }

        return await getDefaultTemplate();
    } catch (error) {
        console.error('Error fetching template:', error);
        return await getDefaultTemplate();
    }
}

// API Functions
function createPrompt(template, prData) {
    return `Generate a comprehensive GitHub pull request description based on the following information:

Template Structure:
${template || 'No template provided - please create a clear, structured description.'}

Pull Request Changes:
- Branch: ${prData.head} → ${prData.base}
- Files Changed: ${prData.files.length}
${prData.files.map(file => `  • ${file.filename} (${file.status}: +${file.additions} -${file.deletions})`).join('\n')}

Commits:
${prData.commits.map(commit => `- ${commit.message}`).join('\n')}

${prData.issues.length ? `Linked Issues:
${prData.issues.map(issue => `- #${issue.number}: ${issue.title}`).join('\n')}` : ''}

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
}

async function generateWithOpenAI(template, prData) {
    const settings = await getAISettings();
    const { apiKey, model } = settings.openai;

    if (!apiKey) {
        throw new Error('OpenAI API key not found. Please add it in the extension settings.');
    }

    if (!AI_MODELS.openai[model]) {
        throw new Error(`Invalid OpenAI model. Available models: ${Object.keys(AI_MODELS.openai).join(', ')}`);
    }

    try {
        const data = await callOpenAIWithRetry(apiKey, model, createPrompt(template, prData));
        return data.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI API error:', error);
        throw new Error(`Failed to generate description: ${error.message}`);
    }
}

async function callOpenAIWithRetry(apiKey, model, prompt, retryCount = 0) {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'makeAPICall',
            data: {
                provider: 'openai',
                apiKey,
                model,
                prompt
            }
        });

        if (response.error) {
            throw new Error(response.error);
        }

        return response;
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAY * Math.pow(2, retryCount);
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

    if (!AI_MODELS.anthropic[model]) {
        throw new Error(`Invalid Claude model. Available models: ${Object.keys(AI_MODELS.anthropic).join(', ')}`);
    }

    try {
        const data = await callClaudeWithRetry(apiKey, model, createPrompt(template, prData));
        return data.content[0].text;
    } catch (error) {
        console.error('Claude API error:', error);
        throw new Error(`Failed to generate description: ${error.message}`);
    }
}

async function callClaudeWithRetry(apiKey, model, prompt, retryCount = 0) {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'makeAPICall',
            data: {
                provider: 'anthropic',
                apiKey,
                model,
                prompt
            }
        });

        if (response.error) {
            throw new Error(response.error);
        }

        return response;
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

// Main function
async function generateDescription() {
    const button = document.getElementById('pr-generator-btn');
    const originalText = button.textContent;
    const textArea = document.querySelector('#pull_request_body');

    try {
        button.textContent = '🔄 Gathering PR data...';
        button.disabled = true;

        textArea.value = 'Generating PR description...\n\nGathering commit information and analyzing changes...';
        textArea.dispatchEvent(new Event('input', { bubbles: true }));

        const pathInfo = getPathInfo();
        const [base, head] = pathInfo.compare || ['main', ''];

        // Fetch all required data
        const [commits, files, settings] = await Promise.all([
            fetchCommits(pathInfo.owner, pathInfo.repo, base, head),
            fetchFilesChanged(pathInfo.owner, pathInfo.repo, base, head),
            getAISettings()
        ]);

        const issues = await fetchLinkedIssues(pathInfo.owner, pathInfo.repo, commits);
        const template = await getPRTemplate(pathInfo.owner, pathInfo.repo);

        const prData = {
            base,
            head,
            commits,
            files,
            issues
        };

        button.textContent = '🤖 Generating with AI...';
        textArea.value = 'Crafting description using AI...\n\nAnalyzing changes and formatting content...';
        textArea.dispatchEvent(new Event('input', { bubbles: true }));

        textArea.value = await (settings.provider === 'anthropic'
            ? generateWithClaude(template, prData)
            : generateWithOpenAI(template, prData));
        textArea.dispatchEvent(new Event('input', { bubbles: true }));

        button.textContent = '✅ Generated!';
        setTimeout(() => {
            button.textContent = originalText;
        }, 2000);

    } catch (error) {
        console.error('Error:', error);
        showError(error.message, button);
        if (textArea.value.includes('Generating PR description...')) {
            textArea.value = '';
            textArea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    } finally {
        button.disabled = false;
    }
}

// Button management
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
