# TV Capture — Scripts

Utility scripts for development and testing.

---

## generate-test-templates.js

Generates 25 test templates for testing drag & drop and template features.

**Usage:**

1. Build the extension: `pnpm build`
2. Load extension in Chrome
3. Open Chrome DevTools Console (F12 or Cmd+Option+I)
4. Run the script:

```bash
node scripts/generate-test-templates.js
```

5. Copy the output snippet and paste it into Chrome DevTools Console
6. Reload the side panel to see the templates

**Output:**
- Console snippet for direct injection
- `test-templates-storage.json` file for reference

---

*Last updated: 2026-04-20*

**Note:** `pack-crx.js` was archived - Chrome Web Store distribution no longer needs `.crx` packaging.
