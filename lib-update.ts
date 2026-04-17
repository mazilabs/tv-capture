/**
 * TV Capture — Update Checker
 *
 * Checks GitHub for new releases and notifies the user.
 * This provides immediate update notifications instead of
 * waiting for Chrome's automatic update check.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GitHubRelease {
  tag_name: string // e.g., "v0.2.0"
  name: string // e.g., "TV Capture v0.2.0"
  html_url: string // GitHub release page URL
  assets: {
    name: string // e.g., "tv-capture-0.2.0.crx"
    browser_download_url: string
  }[]
  body: string // Release notes
}

export interface UpdateCheckResult {
  updateAvailable: boolean
  latestVersion?: string
  currentVersion: string
  releaseUrl?: string
  releaseNotes?: string
}

export interface PendingUpdate {
  version: string
  releaseUrl: string
  releaseNotes?: string
  discoveredAt: number
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GITHUB_REPO = "mazilabs/tv-capture"
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
const CHECK_INTERVAL_MS = 60 * 60 * 1000 // Check every hour

// ---------------------------------------------------------------------------
// Version Comparison
// ---------------------------------------------------------------------------

function parseVersion(version: string): number[] {
  // Remove 'v' prefix if present
  const clean = version.replace(/^v/, "")
  return clean.split(".").map((n) => parseInt(n, 10) || 0)
}

function compareVersions(a: string, b: string): number {
  const aParts = parseVersion(a)
  const bParts = parseVersion(b)

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0
    const bVal = bParts[i] || 0
    if (aVal > bVal) return 1
    if (aVal < bVal) return -1
  }
  return 0
}

// ---------------------------------------------------------------------------
// Update Check
// ---------------------------------------------------------------------------

let lastCheckTime = 0
let cachedResult: UpdateCheckResult | null = null

export function getCurrentVersion(): string {
  return chrome.runtime.getManifest().version
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = getCurrentVersion()

  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "TV-Capture-Extension",
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const release: GitHubRelease = await response.json()
    const latestVersion = release.tag_name.replace(/^v/, "")

    const result: UpdateCheckResult = {
      updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
      latestVersion,
      currentVersion,
      releaseUrl: release.html_url,
      releaseNotes: release.body,
    }

    lastCheckTime = Date.now()
    cachedResult = result

    return result
  } catch (error) {
    console.error("Update check failed:", error)
    return {
      updateAvailable: false,
      currentVersion,
    }
  }
}

export function shouldCheckForUpdate(): boolean {
  const now = Date.now()
  return now - lastCheckTime > CHECK_INTERVAL_MS
}

export function getCachedUpdateResult(): UpdateCheckResult | null {
  return cachedResult
}

// ---------------------------------------------------------------------------
// Notification Storage
// ---------------------------------------------------------------------------

const NOTIFICATION_KEY = "tv-capture-update-notification"
const PENDING_UPDATE_KEY = "tv-capture-pending-update"

export async function hasNotifiedForVersion(version: string): Promise<boolean> {
  const result = await chrome.storage.local.get(NOTIFICATION_KEY)
  return result[NOTIFICATION_KEY] === version
}

export async function markNotifiedForVersion(version: string): Promise<void> {
  await chrome.storage.local.set({ [NOTIFICATION_KEY]: version })
}

export async function clearUpdateNotification(): Promise<void> {
  await chrome.storage.local.remove(NOTIFICATION_KEY)
}

export async function getPendingUpdate(): Promise<PendingUpdate | null> {
  const result = await chrome.storage.local.get(PENDING_UPDATE_KEY)
  return result[PENDING_UPDATE_KEY] || null
}

export async function clearPendingUpdate(): Promise<void> {
  await chrome.storage.local.remove(PENDING_UPDATE_KEY)
}

// ---------------------------------------------------------------------------
// Background Update Check (for service worker)
// ---------------------------------------------------------------------------

export async function runBackgroundUpdateCheck(): Promise<void> {
  if (!shouldCheckForUpdate()) {
    return
  }

  const result = await checkForUpdate()

  if (result.updateAvailable && result.latestVersion) {
    const alreadyNotified = await hasNotifiedForVersion(result.latestVersion)

    if (!alreadyNotified) {
      // Store update info for UI to display
      await chrome.storage.local.set({
        [PENDING_UPDATE_KEY]: {
          version: result.latestVersion,
          releaseUrl: result.releaseUrl,
          releaseNotes: result.releaseNotes,
          discoveredAt: Date.now(),
        } as PendingUpdate,
      })

      await markNotifiedForVersion(result.latestVersion)

      console.log(`Update available: v${result.latestVersion}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Scheduled Update Check (using chrome.alarms)
// ---------------------------------------------------------------------------

export function scheduleUpdateChecks(): void {
  // Create alarm for periodic checks
  chrome.alarms.create("update-check", {
    periodInMinutes: 60, // Check every hour
  })
}

export function handleUpdateAlarm(alarm: chrome.alarms.Alarm): void {
  if (alarm.name === "update-check") {
    runBackgroundUpdateCheck()
  }
}
