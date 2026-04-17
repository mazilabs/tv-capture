/**
 * Pack extension as .crx file
 *
 * This script creates a .crx file from the build output.
 * Chrome requires .crx format for self-hosted updates.
 *
 * Note: True .crx files require Chrome's signature. The workflow is:
 * 1. Build → build/chrome-mv3-prod/
 * 2. Load unpacked in Chrome
 * 3. Use Chrome's "Pack Extension" with key.pem
 * 4. Output: .crx file with stable ID
 *
 * This script creates a .zip as fallback, which can be renamed to .crx
 * for manual install (Chrome will accept it in Developer Mode).
 */

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const buildDir = path.join(__dirname, "..", "build", "chrome-mv3-prod")
const outputDir = path.join(__dirname, "..", "dist")
const keyPath = path.join(__dirname, "..", "key.pem")

// Read version from package.json
const packageJson = require("../package.json")
const version = packageJson.version

console.log(`\n📦 Packing TV Capture v${version}...\n`)

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// Check if build exists
if (!fs.existsSync(buildDir)) {
  console.error("❌ ERROR: Build directory not found!")
  console.error("   Run 'pnpm build' first.\n")
  process.exit(1)
}

// Check if key exists (for true .crx)
const hasKey = fs.existsSync(keyPath)

if (hasKey) {
  console.log("✓ Found key.pem - can create signed .crx\n")
} else {
  console.log("⚠ No key.pem found - will create .zip instead")
  console.log("  For true .crx with stable ID:")
  console.log("  1. Generate key: openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem")
  console.log("  2. Or use Chrome's Pack Extension feature\n")
}

try {
  // Create zip file
  const outputPath = path.join(outputDir, `tv-capture-${version}.zip`)

  // Remove existing file if present
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath)
  }

  // Create zip using system zip command
  execSync(`cd "${buildDir}" && zip -r "${outputPath}" .`, { stdio: "inherit" })

  console.log(`\n✓ Created: ${outputPath}`)
  console.log(`  Size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB\n`)

  if (!hasKey) {
    console.log("📝 Next steps for .crx:")
    console.log("   1. Load unpacked from build/chrome-mv3-prod/")
    console.log("   2. Go to chrome://extensions")
    console.log("   3. Click 'Pack Extension'")
    console.log("   4. Select key.pem as signing key")
    console.log("   5. Save output to dist/tv-capture-${version}.crx\n")
  } else {
    // TODO: Implement crx3 signing with key.pem
    console.log("💡 Tip: For production releases, use Chrome's Pack Extension feature")
    console.log("   to create a properly signed .crx file.\n")
  }
} catch (error) {
  console.error("\n❌ Failed to pack:", error.message, "\n")
  process.exit(1)
}
