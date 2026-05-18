# TV Capture

Chrome extension that captures trading setups from TradingView and sends them to Telegram and Discord.

## Features

- 📸 Screenshot capture from TradingView (Alt+S shortcut)
- ✂️ Auto-crop to chart area
- 📨 Send to Telegram and Discord with one click
- 🔗 Multi-channel send — deliver to multiple channels simultaneously
- 📝 Caption templates for consistent documentation
- 🏷️ Telegram Topics and Discord Threads support
- ⚙️ Configurable channel settings (Telegram bot + Discord webhooks)
- ⌨️ Customizable keyboard shortcuts
- 🎨 Dark glassmorphism UI

## Installation

Install from Chrome Web Store (Unlisted):

1. Get the direct link from the developer
2. Click "Add to Chrome"
3. Configure your channels in Settings (Telegram Bot Token + Chat ID, or Discord Webhook URL)

## Development

```bash
# Install dependencies
pnpm install

# Development mode with HMR
pnpm dev

# Production build
pnpm build

# Create ZIP for CWS upload
cd build/chrome-mv3-prod && zip -r ../../tv-capture.zip .
```

## Tech Stack

- [Plasmo](https://plasmo.com/) - Chrome Extension Framework (MV3)
- React + TypeScript
- Chrome Extensions API
- Discord Webhooks API
- Telegram Bot API

## Distribution

Distributed via **Chrome Web Store (Unlisted)**.

- Not searchable in the Store
- Only accessible via direct link
- Auto-updates handled by Chrome

## License

Private - For internal use only.

---

*Version: 0.2.0*
*Last updated: 2026-05-18*
