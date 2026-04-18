# TV Capture – Release Workflow

## Overview

This document describes how to create a new release of TV Capture for distribution to test users.

---

## ⚠️ Important: Self-Hosted Updates Do Not Work

**We attempted to set up self-hosted auto-updates using GitHub Pages (`gh-pages` branch with `update.xml`). This was removed on 2026-04-18 because:**

1. **Chrome blocks non-CWS extensions on macOS/Windows** (since v127, July 2024)
2. Even with `.crx` and `key.pem` for a stable extension ID, Chrome refuses to enable the extension (toggle is greyed out)
3. There is no user-facing bypass — this is an enforced security boundary

**What was removed:**
- `gh-pages` branch (deleted)
- `update_url` from manifest
- `lib-update.ts` (GitHub API update checker)
- `scripts/update-manifest.js`
- Update banner UI in popup and sidepanel

**Current distribution method:** "Load Unpacked" for development/testing. For production distribution, submit to Chrome Web Store (Unlisted) or Firefox Add-ons.

---

## Prerequisites

- Extension is tested and ready for release
- `key.pem` exists (for stable extension ID — keep this even without auto-updates!)
- You have push access to `mazilabs/tv-capture` repository

---

## Release Process

### Step 1: Version Bump

Update version in `package.json`:

```json
{
  "version": "0.2.0"  // Was "0.1.0"
}
```

Use semantic versioning:

| Type | When to use | Example |
|------|-------------|---------|
| MAJOR | Breaking changes | 1.0.0 → 2.0.0 |
| MINOR | New features | 0.1.0 → 0.2.0 |
| PATCH | Bug fixes | 0.1.0 → 0.1.1 |

During alpha/beta: Start with `0.x.y`

---

### Step 2: Build and Test

```bash
# Clean build
pnpm build

# Load unpacked and test
# chrome://extensions → Load unpacked → build/chrome-mv3-prod
```

Verify all features work correctly.

---

### Step 3: Pack Extension (Optional)

For backup/archive purposes, you can pack the extension:

#### Option A: Using pnpm build:crx

```bash
pnpm build:crx
```

This creates `dist/tv-capture-{version}.zip`.

#### Option B: Using Chrome's Pack Extension

1. Load unpacked from `build/chrome-mv3-prod/`
2. Go to `chrome://extensions`
3. Click **"Pack Extension"** button
4. Extension root: `build/chrome-mv3-prod/`
5. Private key: `key.pem`
6. Click **"Pack Extension"**
7. Move output `.crx` to `dist/tv-capture-{version}.crx`

---

### Step 4: Commit and Tag

```bash
git add .
git commit -m "release: v0.2.0"
git tag v0.2.0
git push origin main --tags
```

---

### Step 5: Create GitHub Release

1. Go to https://github.com/mazilabs/tv-capture/releases/new
2. Select tag: `v0.2.0`
3. Title: `TV Capture v0.2.0`
4. Description: List of changes (use "Generate release notes" button)
5. Attach `.crx` or `.zip` file (optional, for archive)
6. Publish

---

### Step 6: Notify Test Users

Send message to test users with instructions to update:

> New version 0.2.0 is available! To update:
> 1. Go to `chrome://extensions`
> 2. Remove the old extension
> 3. Click "Load unpacked" and select the new `build/chrome-mv3-prod/` folder

---

## Signing Key Management

### Location

`key.pem` should be stored securely and **NEVER committed to git**.

### Why keep it?

Even without self-hosted auto-updates, `key.pem` is important:
- Stable extension ID when loading unpacked
- Required if you later submit to Chrome Web Store
- Required for Firefox self-hosted distribution (backup plan)

### Generating a new key

```bash
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
```

### Backup

Store `key.pem` in a secure location (e.g., encrypted backup, password manager).

**⚠️ Warning:** If you lose `key.pem`, the extension ID will change and users will need to reinstall.

---

## Checklist

Before releasing:

- [ ] Version bumped in `package.json`
- [ ] Build successful (`pnpm build`)
- [ ] Extension tested manually
- [ ] `.crx`/`.zip` packaged (optional, for archive)
- [ ] Git tag created and pushed
- [ ] GitHub Release created (optional)
- [ ] Test users notified with update instructions

---

## Future: Chrome Web Store Distribution

For production distribution with auto-updates, the path forward is:

1. Submit to Chrome Web Store as **Unlisted** (not public, but auto-updates work)
2. Users install once from CWS, then get updates automatically
3. No `gh-pages` or `update.xml` needed

---

*Last updated: 2026-04-18*
*Previous version (with gh-pages): removed due to Chrome blocking non-CWS extensions*
