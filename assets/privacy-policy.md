# TV Capture Privacy Policy

**Last updated:** April 20, 2026

---

## Data We Collect

TV Capture stores the following data **locally on your device** using Chrome's secure storage (`chrome.storage.local`):

| Data | Purpose | Who Provides It |
|------|---------|-----------------|
| **Telegram Bot Token** | Authenticate with Telegram API to send messages | You (entered in Settings) |
| **Telegram Chat ID** | Specify where messages are sent | You (entered in Settings) |
| **Caption Templates** | Pre-written text for screenshot captions | You (created in Settings) |
| **Extension Preferences** | Your settings and preferences | You (via extension UI) |

**We do not collect any data automatically.** All data stored by TV Capture is provided by you.

---

## How We Use Your Data

Your data is used **only** for the extension's core functionality:

| Data | Use |
|------|-----|
| Telegram Bot Token | Send messages to Telegram on your behalf |
| Telegram Chat ID | Deliver messages to your specified chat |
| Screenshots | Sent to your Telegram chat when you click "Send" |
| Caption Templates | Pre-fill messages when sending screenshots |

**Your data never leaves your device except when you explicitly send a screenshot to Telegram.**

---

## Data Sharing

**We do not share your data with anyone.**

- Your Telegram credentials are sent only to Telegram's API (`api.telegram.org`) when you send a message
- Screenshots are sent only to Telegram when you initiate the send action
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

**Your Bot Token and Chat ID are never transmitted except to Telegram's API for authentication.**

---

## Your Rights

You have full control over your data:

### Access Your Data

- Open TV Capture Settings to view your stored credentials and templates

### Delete Your Data

You can delete your data at any time:

1. **Clear credentials:** Open Settings → Delete Bot Token and Chat ID
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
| Templates | Until you delete them or uninstall the extension |
| Screenshots | Not stored — only transmitted when you send |

---

## Third-Party Services

TV Capture integrates with the following third-party service:

### Telegram

- **Website:** https://telegram.org
- **Privacy Policy:** https://telegram.org/privacy
- **Purpose:** Sending screenshots and messages
- **Data Sent:** Your Bot Token, Chat ID, screenshot image, and optional caption

**Telegram's privacy policy governs how Telegram handles your data once transmitted.**

---

## Children's Privacy

TV Capture is not intended for children under 13. We do not knowingly collect any data from children under 13. If you are under 13, please do not use this extension.

---

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be posted on this page with an updated "Last updated" date.

---

## Limited Use Disclosure

TV Capture complies with the Chrome Web Store User Data Policy, including the Limited Use requirements:

- **Allowed Use:** We only use your data to provide the extension's core functionality (sending screenshots to Telegram)
- **Allowed Transfer:** We only transfer data to Telegram API to deliver your messages
- **Prohibited Advertising:** We do not use your data for advertising purposes
- **Prohibited Human Interaction:** No humans read or access your data

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
| Data transmission | Only to Telegram when you send |
| Data sharing | None |
| Data sale | Never |
| User control | Full — you can delete anytime |

---

*This privacy policy is effective as of April 20, 2026.*
