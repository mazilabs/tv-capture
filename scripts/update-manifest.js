/**
 * Generate update.xml for Chrome extension updates
 *
 * This script generates the update manifest that Chrome uses
 * to check for extension updates.
 *
 * Usage:
 *   node scripts/update-manifest.js
 *
 * Environment variables:
 *   EXTENSION_ID - The Chrome extension ID (required)
 *   VERSION      - Version to generate manifest for (default: package.json version)
 */

const fs = require("fs")
const path = require("path")

// Read version from package.json
const packageJson = require("../package.json")
const version = process.env.VERSION || packageJson.version

// Extension ID must be provided
const extensionId = process.env.EXTENSION_ID

if (!extensionId) {
  console.error("\n❌ ERROR: EXTENSION_ID environment variable is required!")
  console.error("   Usage: EXTENSION_ID=your-extension-id node scripts/update-manifest.js\n")
  process.exit(1)
}

const crxUrl = `https://github.com/mazilabs/tv-capture/releases/download/v${version}/tv-capture-${version}.crx`

const updateXml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${extensionId}'>
    <updatecheck codebase='${crxUrl}' version='${version}' />
  </app>
</gupdate>
`

const outputDir = path.join(__dirname, "..", "dist")
const outputPath = path.join(outputDir, "update.xml")

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

fs.writeFileSync(outputPath, updateXml)

console.log(`\n✓ Generated update.xml for v${version}`)
console.log(`  Extension ID: ${extensionId}`)
console.log(`  CRX URL: ${crxUrl}`)
console.log(`  Output: ${outputPath}\n`)

console.log("📝 Next steps:")
console.log("   1. Copy update.xml to gh-pages branch:")
console.log("      git checkout gh-pages")
console.log("      cp dist/update.xml updates/update.xml")
console.log("      git add updates/update.xml")
console.log("      git commit -m 'update: v${version}'")
console.log("      git push origin gh-pages")
console.log("      git checkout main\n")
