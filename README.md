# TV Capture

Chrome extension that captures trading setups from TradingView and sends them to Telegram.

## Features

- 📸 Screenshot capture from TradingView (Alt+S shortcut)
- ✂️ Auto-crop to chart area
- 📨 Send to Telegram with one click
- 📝 Caption templates for consistent documentation
- ⚙️ Configurable Telegram bot settings

## Installation

Install from Chrome Web Store (Unlisted):

1. Get the direct link from the developer
2. Click "Add to Chrome"
3. Configure your Telegram Bot Token and Chat ID in Settings

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

## Distribution

Distributed via **Chrome Web Store (Unlisted)**.

- Not searchable in the Store
- Only accessible via direct link
- Auto-updates handled by Chrome

## License

Private - For internal use only.

---

*Version: 0.1.0*
*Last updated: 2026-04-20*
