# TV Capture Privacy Policy

**Last updated:** May 18, 2026

---

## Data We Collect

TV Capture stores the following data **locally on your device** using Chrome's secure storage (`chrome.storage.local`):

| Data | Purpose | Who Provides It |
|------|---------|-----------------|
| **Telegram Bot Token** | Authenticate with Telegram API to send messages | You (entered in Settings) |
| **Telegram Chat ID** | Specify where Telegram messages are sent | You (entered in Settings) |
| **Discord Webhook URL** | Authenticate with Discord to send messages | You (entered in Settings) |
| **Caption Templates** | Pre-written text for screenshot captions | You (created in Settings) |
| **Extension Preferences** | Your settings and preferences | You (via extension UI) |
| **Feedback Messages** | Optional feedback you choose to send | You (via Feedback form) |

**We do not collect any data automatically.** All data stored by TV Capture is provided by you.

---

## How We Use Your Data

Your data is used **only** for the extension's core functionality:

| Data | Use |
|------|-----|
| Telegram Bot Token | Send messages to Telegram on your behalf |
| Telegram Chat ID | Deliver messages to your specified Telegram chat |
| Discord Webhook URL | Send messages to Discord on your behalf |
| Screenshots | Sent to your selected channels when you click "Send" |
| Caption Templates | Pre-fill messages when sending screenshots |
| Feedback Messages | Sent to our feedback group for product improvement |

**Your data never leaves your device except when you explicitly send a message or screenshot to your configured channels.**

---

## Multi-Channel Send

TV Capture supports sending to **multiple channels simultaneously** (Telegram and Discord). When you select multiple channels and click "Send":

- Your screenshot and caption are sent to **each selected channel independently**
- Each channel uses its own credentials (your Telegram bot token or Discord webhook)
- No data is shared between channels
- You control which channels receive each message

---

## Data Sharing

**We do not share your data with anyone.**

- Your Telegram credentials are sent only to Telegram's API (`api.telegram.org`) when you send a message
- Your Discord webhook URL is used only to send messages to your Discord channel
- Screenshots are sent only to the channels you select when you initiate the send action
- No data is transmitted to any other servers or third parties
- No analytics, tracking, or advertising

---

## Data Storage & Security

### Where Your Data Is Stored

All your settings and credentials are stored locally in Chrome's `chrome.storage.local` API:

- **Location:** On your device only
- **Encryption:** Chrome encrypts this data at rest
- **Access:** Only TV Capture can access this data

### Data Transmission

All data transmitted by TV Capture uses secure connections:

| Destination | Protocol | Purpose |
|-------------|----------|---------|
| `api.telegram.org` | HTTPS (TLS) | Send messages and photos to Telegram |
| `discord.com/api/webhooks` | HTTPS (TLS) | Send messages and photos to Discord |

**Your credentials are never transmitted except to the APIs you have configured.**

---

## Your Rights

You have full control over your data:

### Access Your Data

- Open TV Capture Settings to view your stored credentials and templates

### Delete Your Data

You can delete your data at any time:

1. **Clear credentials:** Open Settings → Delete Bot Token, Chat ID, or Webhook URL
2. **Delete templates:** Open Settings → Templates → Delete individual templates
3. **Remove all data:** Uninstall the extension

### Export Your Data

- TV Capture does not currently offer data export
- Templates can be copied manually from the Settings UI

---

## Data Retention

| Data | Retention Period |
|------|------------------|
| Telegram credentials | Until you delete them or uninstall the extension |
| Discord credentials | Until you delete them or uninstall the extension |
| Templates | Until you delete them or uninstall the extension |
| Screenshots | Not stored — only transmitted when you send |
| Feedback messages | Sent to feedback group; not stored locally |

---

## Third-Party Services

TV Capture integrates with the following third-party services:

### Telegram

- **Website:** https://telegram.org
- **Privacy Policy:** https://telegram.org/privacy
- **Purpose:** Sending screenshots and messages
- **Data Sent:** Your Bot Token, Chat ID, screenshot image, and optional caption

### Discord

- **Website:** https://discord.com
- **Privacy Policy:** https://discord.com/privacy
- **Purpose:** Sending screenshots and messages via webhooks
- **Data Sent:** Your Webhook URL, screenshot image, and optional caption

**Each third-party's privacy policy governs how they handle your data once transmitted.**

---

## Feedback Feature

TV Capture includes an optional feedback form in Settings. If you choose to send feedback:

- **What is sent:** Your message, selected topic, extension version, browser info, and timestamp
- **Where it goes:** To a dedicated Telegram group for product improvement
- **Optional:** Name field is optional; you can remain anonymous
- **Voluntary:** You are never required to send feedback

---

## Children's Privacy

TV Capture is not intended for children under 13. We do not knowingly collect any data from children under 13. If you are under 13, please do not use this extension.

---

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be posted on this page with an updated "Last updated" date.

---

## Limited Use Disclosure

TV Capture complies with the Chrome Web Store User Data Policy, including the Limited Use requirements:

- **Allowed Use:** We only use your data to provide the extension's core functionality (sending screenshots to your configured channels)
- **Allowed Transfer:** We only transfer data to Telegram API and Discord webhooks to deliver your messages
- **Prohibited Advertising:** We do not use your data for advertising purposes
- **Prohibited Human Interaction:** No humans read or access your data except anonymous feedback messages you voluntarily submit

---

## Contact

For questions about this privacy policy or TV Capture's data practices:

**Developer:** TV Capture Team
**Email:** ricomazi@outlook.com

---

## Summary

| Aspect | What We Do |
|--------|------------|
| Data collected | Minimal — only what you provide |
| Data storage | Local on your device (encrypted) |
| Data transmission | Only to channels you configure when you send |
| Data sharing | None |
| Data sale | Never |
| User control | Full — you can delete anytime |

---

*This privacy policy is effective as of May 18, 2026.*
