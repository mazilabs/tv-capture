# TV Capture – Release Workflow

## Overview

This document describes how to create a new release of TV Capture for distribution to test users.

---

## Prerequisites

- Extension is tested and ready for release
- `key.pem` exists (for stable extension ID)
- GitHub Pages is enabled (`gh-pages` branch)
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

### Step 3: Pack Extension

#### Option A: Using pnpm build:crx

```bash
pnpm build:crx
```

This creates `dist/tv-capture-{version}.zip`.

#### Option B: Using Chrome's Pack Extension (Recommended for .crx)

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
5. Attach `.crx` or `.zip` file
6. Publish

---

### Step 6: Update update.xml

Generate the update manifest:

```bash
EXTENSION_ID=your-extension-id node scripts/update-manifest.js
```

Then update `gh-pages` branch:

```bash
# Switch to gh-pages branch
git checkout gh-pages

# Copy generated update.xml
cp dist/update.xml updates/update.xml

# Commit and push
git add updates/update.xml
git commit -m "update: v0.2.0"
git push origin gh-pages

# Switch back to main
git checkout main
```

---

### Step 7: Verify Update URL

Test that the update manifest is accessible:

```bash
curl https://mazilabs.github.io/tv-capture/updates/update.xml
```

Should return XML with the new version.

---

### Step 8: Notify Test Users

Send message to test users:

> New version 0.2.0 is available! Open the TV Capture extension and click "Update Now" to get the latest version.

---

## Quick Reference

### Files to update for each release

| File | What to change |
|------|----------------|
| `package.json` | `version` field |
| `gh-pages/updates/update.xml` | `version` and `codebase` URL |

### Files generated during release

| File | Location |
|------|----------|
| Build output | `build/chrome-mv3-prod/` |
| .crx/.zip package | `dist/tv-capture-{version}.crx` |
| update.xml | `dist/update.xml` |

---

## Rollback Procedure

If a release has critical bugs:

1. Fix the issue or revert to previous code
2. Create a hotfix release (e.g., `0.2.1`)
3. Update `gh-pages/updates/update.xml` to point to the fixed version
4. Notify users

Alternatively, to revert to an older version:

1. Update `gh-pages/updates/update.xml` with old version URL
2. Notify users to reinstall

---

## Signing Key Management

### Location

`key.pem` should be stored securely and **NEVER committed to git**.

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
- [ ] `.crx`/`.zip` packaged
- [ ] Git tag created and pushed
- [ ] GitHub Release created with attachment
- [ ] `update.xml` updated on `gh-pages`
- [ ] Update URL verified
- [ ] Test users notified

---

*Last updated: 2026-04-17*
