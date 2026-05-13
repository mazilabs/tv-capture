/**
 * TV Capture — Template Storage Layer
 *
 * Manages templates for photo captions.
 * Templates are stored in chrome.storage.local with auto-incrementing IDs.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Template = {
  id: number
  name: string
  body: string
  order: number
}

export type TemplateStorage = {
  idCounter: number
  templates: Template[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "tv-capture-templates"

const DEFAULT_STORAGE: TemplateStorage = {
  idCounter: 2, // Next ID to assign (after default template with ID 1)
  templates: [
    {
      id: 1,
      name: "📝 Default",
      body: "📸 Setup captured from TradingView",
      order: 0,
    },
  ],
}

// ---------------------------------------------------------------------------
// Storage Helpers
// ---------------------------------------------------------------------------

/**
 * Load template storage from chrome.storage.local.
 * Initializes with default template on first call.
 */
export async function loadTemplateStorage(): Promise<TemplateStorage> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const raw = result[STORAGE_KEY]

  if (!raw) {
    // Always create a fresh storage object with a new templates array.
    // Using DEFAULT_STORAGE directly or { ...DEFAULT_STORAGE } would share
    // the templates array by reference (shallow spread), causing mutations
    // to leak into the module-level constant.
    const fresh: TemplateStorage = {
      idCounter: 2,
      templates: [
        {
          id: 1,
          name: "📝 Default",
          body: "📸 Setup captured from TradingView",
          order: 0,
        },
      ],
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: fresh })
    return fresh
  }

  return raw as TemplateStorage
}

/**
 * Save template storage to chrome.storage.local.
 */
export async function saveTemplateStorage(storage: TemplateStorage): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: storage })
}

/**
 * Get all templates sorted by order field.
 */
export async function getTemplates(): Promise<Template[]> {
  const storage = await loadTemplateStorage()
  return [...storage.templates].sort((a, b) => a.order - b.order)
}

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Create a new template.
 * Assigns next available ID and appends to end of list.
 */
export async function createTemplate(
  name: string,
  body: string
): Promise<Template> {
  const storage = await loadTemplateStorage()

  const id = storage.idCounter
  const order = storage.templates.length

  const newTemplate: Template = {
    id,
    name: name.trim(),
    body,
    order,
  }

  storage.templates.push(newTemplate)
  storage.idCounter++

  await saveTemplateStorage(storage)

  return newTemplate
}

/**
 * Update an existing template's name and body.
 * Order remains unchanged.
 */
export async function updateTemplate(
  id: number,
  name: string,
  body: string
): Promise<void> {
  const storage = await loadTemplateStorage()

  const template = storage.templates.find((t) => t.id === id)
  if (!template) {
    throw new Error(`Template with id ${id} not found`)
  }

  template.name = name.trim()
  template.body = body

  await saveTemplateStorage(storage)
}

/**
 * Delete a template by ID.
 * Re-calculates order for remaining templates.
 * ID counter is NOT decremented (IDs are never reused).
 */
export async function deleteTemplate(id: number): Promise<void> {
  const storage = await loadTemplateStorage()

  const index = storage.templates.findIndex((t) => t.id === id)
  if (index === -1) {
    return // Template doesn't exist, nothing to do
  }

  // Remove template
  storage.templates.splice(index, 1)

  // Re-calculate order for remaining templates
  storage.templates.sort((a, b) => a.order - b.order)
  storage.templates.forEach((t, i) => {
    t.order = i
  })

  // Note: idCounter is NOT decremented
  // IDs are never reused, even after deletion

  await saveTemplateStorage(storage)
}

/**
 * Update template order after drag & drop.
 * sortedIds is an array of template IDs in their new order.
 */
export async function updateTemplateOrder(sortedIds: number[]): Promise<void> {
  const storage = await loadTemplateStorage()

  // Update order field for each template
  sortedIds.forEach((id, index) => {
    const template = storage.templates.find((t) => t.id === id)
    if (template) {
      template.order = index
    }
  })

  await saveTemplateStorage(storage)
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Clear all templates (for testing).
 */
export async function clearTemplates(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY)
}

/**
 * Reset to default templates (for testing).
 */
export async function resetTemplates(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_STORAGE })
}
