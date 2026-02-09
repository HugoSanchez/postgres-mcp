# TipTap Reader MVP Plan

## Current State

- Chapters stored as **raw HTML strings** in `epubChapter.html` column
- Reader uses `dangerouslySetInnerHTML` pattern in `epub-chapter.tsx`
- ProseMirror already in codebase (for markdown notes editor)
- Highlights/annotations use character offsets (should still work with TipTap)

## Goal

Replace the raw HTML rendering with a TipTap editor in read-only mode, using TipTap's `generateJSON` to convert existing HTML to TipTap's document format.

---

## Phase 1: Setup & Basic Rendering

### Step 1: Install TipTap packages
```bash
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/html @tiptap/extension-underline
```

### Step 2: Create TipTap reader component
Create `components/reader/tiptap-reader.tsx`:
- Read-only TipTap editor
- Accept HTML string as input
- Convert HTML → TipTap JSON using `generateJSON`
- Render with consistent prose styles

### Step 3: Integrate into epub-chapter.tsx
- Replace the current `innerHTML` approach with TipTap component
- Keep existing highlight/annotation rendering for now (Phase 2)

### Step 4: Test with existing content
- Load an EPUB document → verify rendering
- Load a PDF document → verify rendering
- Compare output quality vs current HTML rendering

---

## Phase 2: Highlights & Annotations (Future)

- TipTap has a "marks" system for inline formatting
- Highlights could become custom TipTap marks
- This would be cleaner than DOM manipulation
- **Not in MVP scope**

---

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add TipTap dependencies |
| `components/reader/tiptap-reader.tsx` | **NEW** - TipTap read-only component |
| `components/reader/epub-chapter.tsx` | Use TipTap instead of innerHTML |

---

## Success Criteria

1. Documents render in TipTap without errors
2. Formatting preserved: headings, paragraphs, bold, italic, lists, links
3. No visual regression (or improvement) vs current rendering
4. Infinite scroll still works (chapters load on demand)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| TipTap parsing loses content | Compare text content before/after |
| Highlight offsets break | Phase 2 concern - keep old system initially |
| Performance with large chapters | TipTap is efficient, but monitor |
| Missing HTML elements (tables, etc.) | Add TipTap extensions as needed |

---

## Let's Start

Begin with Step 1: Install packages, then create the basic TipTap reader component.
