#!/usr/bin/env node
/**
 * TV Capture — Generate Test Templates
 *
 * This script injects 25 test templates into chrome.storage.local
 * for testing drag & drop and other template features.
 *
 * Usage:
 *   1. Build the extension: pnpm build
 *   2. Load extension in Chrome
 *   3. Open Chrome DevTools → Application → Storage → Local Storage
 *   4. Find the extension's storage (chrome-extension://...)
 *   5. Run this script OR paste the console snippet below
 *
 * Console Snippet (paste in DevTools Console while extension is open):
 * 
 * // Generate 25 test templates
 * (async () => {
 *   const { createTemplate } = await import(chrome.runtime.getURL('lib-templates.js'));
 *   for (let i = 1; i <= 25; i++) {
 *     await createTemplate(`📋 Template ${i}`, `Trading setup #${i} - Message content here`);
 *   }
 *   console.log('✅ 25 test templates created');
 * })();
 *
 * Alternative (direct storage manipulation - paste in DevTools Console):
 */

const fs = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// Template Generator
// ---------------------------------------------------------------------------

function generateTestTemplates(count = 25) {
  const templates = []
  
  for (let i = 1; i <= count; i++) {
    templates.push({
      id: i,
      name: `📋 Template ${i}`,
      body: `Trading setup #${i}\n\nEntry: XXX\nStop: XXX\nTarget: XXX\n\nNotes: Message ${i} content here.`,
      order: i - 1,
    })
  }
  
  return {
    idCounter: count + 1,
    templates: templates,
  }
}

// ---------------------------------------------------------------------------
// Console Snippet Output
// ---------------------------------------------------------------------------

function printConsoleSnippet() {
  const storage = generateTestTemplates(25)
  
  console.log('\n' + '='.repeat(70))
  console.log('PASTE THIS INTO CHROME DEVTOOLS CONSOLE:')
  console.log('='.repeat(70))
  console.log(`
// Generate 25 test templates for TV Capture
chrome.storage.local.set({
  "tv-capture-templates": ${JSON.stringify(storage, null, 2)}
}, () => {
  console.log('✅ 25 test templates injected');
  console.log('Reload the side panel to see them.');
});
`)
  console.log('='.repeat(70))
  console.log('\nSteps:')
  console.log('1. Open TV Capture side panel')
  console.log('2. Open Chrome DevTools (F12 or Cmd+Option+I)')
  console.log('3. Go to Console tab')
  console.log('4. Paste the code above')
  console.log('5. Press Enter')
  console.log('6. Close and reopen the side panel (or go to Settings → Templates)')
  console.log('')
}

// ---------------------------------------------------------------------------
// File Output (for direct manipulation)
// ---------------------------------------------------------------------------

function saveToFile() {
  const storage = generateTestTemplates(25)
  const outputPath = path.join(__dirname, 'test-templates-storage.json')
  
  fs.writeFileSync(outputPath, JSON.stringify(storage, null, 2))
  console.log(`\n✅ Saved to: ${outputPath}`)
  console.log('You can manually import this to chrome.storage.local if needed.')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('\n📦 TV Capture — Test Template Generator\n')

printConsoleSnippet()
saveToFile()
