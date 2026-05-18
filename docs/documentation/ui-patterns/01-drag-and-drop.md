# Drag & Drop — Architecture, Rules, and Lessons Learned

**Release:** 0.2.0  
**Date:** 2026-05-18  
**Scope:** Settings UI (Message Templates) + Send UI (Channels + Sub-Entities)  
**Status:** ✅ Resolved — Deterministic, zero-size-change D&D achieved

---

## 1. Target State

Drag & Drop in TV Capture must be **deterministic and pixel-perfect**:

1. **Container dimensions NEVER change during drag** — width, height, padding, margin, and border width remain identical regardless of drag position, drop target, or list composition
2. **Vertical-only movement** — items move only along the Y axis; horizontal shifting is prohibited
3. **Visual feedback through color only** — border color, background color, box-shadow, cursor, and opacity of OTHER items change; the dragged item itself stays fully opaque
4. **No DragOverlay** — pure in-place sorting; the dragged element stays in the DOM flow at all times
5. **Sub-entity D&D inside channel cards** — threads/topics can be reordered within their parent card independently

---

## 2. Architecture

### 2.1 Technology Stack

| Library | Version | Purpose |
|---------|---------|---------|
| `@dnd-kit/core` | — | DndContext, sensors, collision detection |
| `@dnd-kit/sortable` | — | SortableContext, useSortable, verticalListSortingStrategy |
| `@dnd-kit/modifiers` | — | restrictToVerticalAxis, restrictToParentElement |
| `@dnd-kit/utilities` | — | CSS.Translate (NOT CSS.Transform) |

### 2.2 Component Hierarchy

```
Settings UI — Message Templates:
  DndContext (modifiers: restrictToVerticalAxis, restrictToParentElement)
    SortableContext (strategy: verticalListSortingStrategy)
      SortableTemplateItem (useSortable → CSS.Translate)
        TemplateListItem (inner component, no D&D logic)

Send UI — Channels:
  DndContext (modifiers: restrictToVerticalAxis, restrictToParentElement)
    SortableContext (strategy: verticalListSortingStrategy)
      SortableSendChannelCard (useSortable → CSS.Translate)
        SendChannelCard (inner component, no D&D logic)
          DndContext (nested — sub-entity reordering)
            SortableContext (strategy: verticalListSortingStrategy)
              SortableSendSubEntityRow (useSortable → CSS.Translate)
                SendSubEntityRow (inner component, no D&D logic)
```

### 2.3 Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Transform function | `CSS.Translate.toString()` | Removes scaleX/scaleY that cause size distortion with variable-height items |
| DragOverlay | Not used | In-place sorting is simpler and avoids overlay sync issues |
| Modifiers | `restrictToVerticalAxis` + `restrictToParentElement` | Prevents horizontal movement and keeps items within their container |
| Visual feedback | Border color + background + box-shadow + opacity of others | Only properties that don't affect layout |
| Margin placement | On sortable wrapper, not inner component | Prevents margin collapse during transform |
| Border strategy | Always 1px solid, only color changes | Prevents border-width-induced size changes |

---

## 3. The Root Cause: CSS.Transform vs CSS.Translate

### 3.1 Problem Description

When dragging Send UI channel cards, containers would **compress or stretch horizontally** at certain drag positions. The Settings UI Message Templates worked perfectly. The difference: Templates have uniform heights; Channel cards have **variable heights** (some have sub-entities, some don't).

### 3.2 SRE 5-Whys Analysis

**Symptom:** Container dimensions change during drag — horizontal compression/stretching.

**Why 1:** Why do containers change dimensions?  
→ dnd-kit applies a `scaleX`/`scaleY` transformation to items during drag.

**Why 2:** Why does dnd-kit apply scale transformations?  
→ `CSS.Transform.toString(transform)` includes both `translate` and `scale` components. dnd-kit calculates scale factors based on the size difference between the dragged item and the item it's being moved over.

**Why 3:** Why doesn't this affect Templates?  
→ All Template items have the **same height**. When all items are the same size, the scale factor is always 1, so no visible distortion occurs. Channel cards have **variable heights** (with/without sub-entities), causing scale factors ≠ 1.

**Why 4:** Why was `CSS.Transform.toString()` used instead of `CSS.Translate.toString()`?  
→ The dnd-kit documentation and examples default to `CSS.Transform.toString()`. The `CSS.Translate` alternative is only documented in GitHub issues and StackOverflow answers.

**Why 5 (ROOT CAUSE):** The structural root cause is using `CSS.Transform.toString(transform)` with variable-height sortable items. This is a **known dnd-kit issue** documented in:
- GitHub Issue #44: "Sortable elements with variable size looks weird when dragging"
- GitHub Issue #117: "Variable sized sortables stretched when dragged"
- GitHub Issue #817: "useSortable with variable size items, transform scales is strange"
- GitHub Issue #1138: "Variable height items stretching and compressing in sortable list"
- dnd-kit docs Issue #27: "Use CSS.Translate.toString() instead of CSS.Transform.toString() to prevent scale transformation issues"
- StackOverflow: "The items are stretched because you're using CSS.Transform.toString(), use CSS.Translate.toString()"

### 3.3 The Fix

**One-line change in each sortable wrapper:**

```tsx
// BEFORE (causes horizontal stretching with variable-height items):
transform: CSS.Transform.toString(transform),

// AFTER (only applies translation, no scale):
transform: CSS.Translate.toString(transform),
```

**Files changed:**
| File | Component | Change |
|------|-----------|--------|
| `sidepanel.tsx` | `SortableSendChannelCard` | `CSS.Transform.toString()` → `CSS.Translate.toString()` |
| `SendChannelCard.tsx` | `SortableSendSubEntityRow` | `CSS.Transform.toString()` → `CSS.Translate.toString()` |

**Note:** `SortableTemplateItem.tsx` was left unchanged at `CSS.Transform.toString()` because all Template items have uniform height, so the scale factor is always 1 and no distortion occurs. However, for consistency and future-proofing, it could also be changed to `CSS.Translate.toString()`.

---

## 4. CSS Properties Rules for Drag Visuals

### 4.1 Allowed Properties (No Layout Impact)

These properties can change during drag without affecting container dimensions:

| Property | Effect | Usage in TV Capture |
|----------|--------|---------------------|
| `borderColor` | Changes color only | Teal (`#14b8a6`) when dragging, transparent when idle |
| `backgroundColor` | Changes color only | Teal highlight (`rgba(13, 148, 136, 0.08)`) when dragging |
| `boxShadow` | No layout impact | Elevation shadow (`0 8px 24px rgba(0, 0, 0, 0.4)`) when dragging |
| `cursor` | No layout impact | `grabbing` when dragging |
| `zIndex` | No layout impact | `1000` when dragging |
| `opacity` (of OTHER items) | No layout impact | `0.5` for non-dragged items when any item is being dragged |

### 4.2 Prohibited Properties (Layout Impact)

These properties MUST NOT change during drag:

| Property | Why Prohibited |
|----------|---------------|
| `scale()` | Changes rendered dimensions — the original bug |
| `width` | Changes container width |
| `height` | Changes container height |
| `margin` | Changes spacing between elements |
| `padding` | Changes internal spacing |
| `overflow` | Can trigger subpixel re-rendering |
| `border-width` | Changes container dimensions |
| `border-radius` | Can trigger subpixel rendering differences |

### 4.3 The "Always Present" Border Pattern

To change border color without changing border width:

```tsx
// CORRECT: Border always exists, only color changes
border: "1px solid",
borderColor: isDragging ? "#14b8a6" : "transparent",

// WRONG: Border appears/disappears, changing dimensions
border: isDragging ? "1px solid #14b8a6" : "none",
```

### 4.4 The "Margin on Wrapper" Pattern

To ensure consistent spacing during drag:

```tsx
// CORRECT: Margin on the sortable wrapper (outside transform)
// SortableSendChannelCard wrapper:
marginBottom: 8,

// WRONG: Margin on the inner component (inside transform)
// SendChannelCard inner component:
// marginBottom: 8,  ← REMOVED
```

---

## 5. Previous Approaches That Failed

### 5.1 DragOverlay Approach (Phase 37 — Abandoned)

**What was tried:** Adding `DragOverlay` from `@dnd-kit/core` to render the dragged element outside the normal document flow.

**Why it was abandoned:**
- Added significant complexity (overlay rendering, placeholder mode, `isOverlay` prop)
- Required disabling sub-entity D&D during channel drag
- Required static rendering of sub-entities in overlay mode
- The overlay element needed to be kept in sync with the original
- Did not address the root cause (scale transformation)

**Lesson:** DragOverlay is useful for complex drag scenarios (drag between containers, custom drop zones). For simple in-place vertical sorting, it's over-engineering. The root cause was `CSS.Transform.toString()`, not the absence of DragOverlay.

### 5.2 Removing `overflow: hidden` (Partial Fix)

**What was tried:** Removing `overflow: "hidden"` from `SendChannelCard` styles.

**Why it was insufficient:**
- `overflow: hidden` was causing subpixel re-rendering issues during transform
- Removing it helped with some rendering artifacts
- But it did NOT fix the horizontal stretching/compression
- The root cause was the scale transformation, not overflow

### 5.3 Moving `marginBottom` to Wrapper (Partial Fix)

**What was tried:** Moving `marginBottom` from inner `SendSubEntityRow` to `SortableSendSubEntityRow` wrapper.

**Why it was insufficient:**
- Prevented margin collapse during transform
- Consistent with the working Template pattern
- But did NOT fix the horizontal stretching/compression
- Again, the root cause was the scale transformation

---

## 6. Complete Fix Summary

The definitive fix required **three changes**, each addressing a different aspect:

| # | Change | File | What It Fixes |
|---|--------|------|---------------|
| 1 | `CSS.Transform.toString()` → `CSS.Translate.toString()` | `sidepanel.tsx` (SortableSendChannelCard) | **Root cause** — eliminates scaleX/scaleY that stretch variable-height items |
| 2 | `CSS.Transform.toString()` → `CSS.Translate.toString()` | `SendChannelCard.tsx` (SortableSendSubEntityRow) | Same root cause for sub-entity D&D |
| 3 | Remove `overflow: "hidden"` from card styles | `SendChannelCard.tsx` | Subpixel re-rendering artifacts during transform |
| 4 | Move `marginBottom` from inner to wrapper | `SendChannelCard.tsx` | Margin collapse during transform |
| 5 | Always-present border (1px solid, color changes only) | `sidepanel.tsx` (SortableSendChannelCard) | Border-width-induced size changes |
| 6 | Visual feedback via allowed properties only | Both files | Color/shadow/opacity changes without layout impact |

---

## 7. Component Reference

### 7.1 Settings UI — Message Templates

| Component | File | Role |
|-----------|------|------|
| `SortableTemplateItem` | `components/SortableTemplateItem.tsx` | Sortable wrapper with `useSortable` + `CSS.Transform.toString()` |
| `TemplateListItem` | `components/TemplateListItem.tsx` | Inner component (no D&D logic) |
| `DndContext` | `sidepanel.tsx` (SettingsView) | Outer D&D context with modifiers |

### 7.2 Send UI — Channels

| Component | File | Role |
|-----------|------|------|
| `SortableSendChannelCard` | `sidepanel.tsx` | Sortable wrapper with `useSortable` + `CSS.Translate.toString()` |
| `SendChannelCard` | `components/SendChannelCard.tsx` | Inner component (renders card + nested D&D) |
| `DndContext` (outer) | `sidepanel.tsx` (CaptureView) | Channel-level D&D context with modifiers |

### 7.3 Send UI — Sub-Entities (Topics/Threads)

| Component | File | Role |
|-----------|------|------|
| `SortableSendSubEntityRow` | `components/SendChannelCard.tsx` | Sortable wrapper with `useSortable` + `CSS.Translate.toString()` |
| `SendSubEntityRow` | `components/SendSubEntityRow.tsx` | Inner component (no D&D logic) |
| `DndContext` (inner) | `components/SendChannelCard.tsx` | Sub-entity D&D context (nested inside channel card) |

---

## 8. Testing Checklist

When modifying D&D behavior, verify these scenarios:

- [ ] **Uniform-height items** (Templates): Drag and drop — no size change
- [ ] **Variable-height items** (Channels): Drag compact card between extended cards — no size change
- [ ] **Variable-height items** (Channels): Drag extended card between compact cards — no size change
- [ ] **Sub-entity D&D**: Reorder topics/threads within a card — no size change
- [ ] **Vertical-only movement**: Items move only along Y axis
- [ ] **Visual feedback**: Teal border + background highlight on dragged item
- [ ] **Other items fade**: Non-dragged items show reduced opacity
- [ ] **Order persistence**: Reordered items persist after panel close/reopen
- [ ] **Build**: `pnpm build` completes with zero errors

---

## 9. Key Takeaways

1. **Always use `CSS.Translate.toString()` for sortable items with variable heights.** `CSS.Transform.toString()` includes `scaleX`/`scaleY` which causes horizontal stretching when items have different heights.

2. **For uniform-height items, both functions work identically.** But using `CSS.Translate.toString()` everywhere is safer and more consistent — it's a future-proof default.

3. **Never change layout-affecting CSS properties during drag.** Only `borderColor`, `backgroundColor`, `boxShadow`, `cursor`, `zIndex`, and `opacity` (of other items) are safe.

4. **Always use "always present" borders.** Set `border: "1px solid"` with `borderColor` changing between visible and transparent — never toggle border existence.

5. **Place spacing margins on the sortable wrapper, not the inner component.** This prevents margin collapse during CSS transforms.

6. **Avoid `overflow: hidden` on sortable containers.** It can cause subpixel re-rendering artifacts during CSS transforms.

7. **DragOverlay is overkill for simple in-place vertical sorting.** Only use it for cross-container drag or custom drop zones. The root cause of size distortion is almost always `CSS.Transform.toString()` with variable-height items.

---

*Document version: 1.0*  
*Last updated: 2026-05-18*