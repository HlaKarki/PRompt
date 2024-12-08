# PRompt - AI-Powered PR Description Generator

<p align="center">
  🤖 A Chrome extension that automatically generates comprehensive pull request descriptions using AI
</p>

## Features

- 🎯 Automatically generates detailed PR descriptions based on your changes
- 🔄 Analyzes commits, file changes, and linked issues
- 📝 Supports custom PR templates
- 🤖 Choose between OpenAI (GPT) or Anthropic (Claude) AI models
- 🔒 Privacy-focused: All data processing happens locally
- 🎨 Dark mode support
- ⚡ Fast and lightweight

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Setup

1. Click the PRompt extension icon in your Chrome toolbar
2. Choose your preferred AI provider (OpenAI or Anthropic)
3. Enter your API key:
    - For OpenAI: Get your key from [OpenAI Platform](https://platform.openai.com/api-keys)
    - For Anthropic: Get your key from [Anthropic Console](https://console.anthropic.com/)
4. Select your preferred model
5. Click "Save Settings"

## Usage

1. Create or open a pull request on GitHub
2. Look for the "🤖 Generate Description" button above the description field
3. Click the button to automatically generate a comprehensive PR description
4. Edit the generated description as needed

## Available Models

### OpenAI
- GPT-4 (Most capable & Most Expensive)
- GPT-4 Turbo (Faster)
- GPT-3.5 (Fastest & Cheapest)

### Anthropic
- Claude-3 Opus (Most powerful & Most Expensive)
- Claude-3.5 Sonnet (Most intelligent)
- Claude-3.5 Haiku (Fastest & Cheapest)

## Privacy

PRompt takes your privacy seriously:
- No data collection or tracking
- API keys stored locally in your browser
- No external servers or analytics
- Only processes PR data when you click generate

For detailed information, see our [Privacy Policy](PRIVACY.md).

## Development

### Project Structure
```
PRompt/
├── manifest.json # Extension configuration
├── popup.html # Settings popup interface
├── popup.js # Settings management
├── popup.css # Popup styles
├── content.js # Main extension logic
├── background.js # Background service worker
├── styles.css # Content styles
└── assets/
      └── default_template.md # Default PR template
```

### Local Development

1. Make changes to the code
2. Reload the extension in `chrome://extensions/`
3. Test changes on GitHub PR pages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have suggestions, please [open an issue](https://github.com/HlaKarki/PRompt/issues).

---

Made with ❤️ by <a href="https://github.com/HlaKarki">Hla Htun</a>