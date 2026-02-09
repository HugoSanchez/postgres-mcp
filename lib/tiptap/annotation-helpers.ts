import type { Editor } from '@tiptap/react';

export interface AnnotationPosition {
  id: string;
  color: string;
  from: number;
  to: number;
  text: string;
}

/**
 * Apply an annotation mark to the current selection
 */
export function applyAnnotationMark(
  editor: Editor,
  options: { id: string; color: string; type?: string }
): boolean {
  if (editor.state.selection.empty) {
    return false;
  }

  return editor.chain().focus().setAnnotation(options).run();
}

/**
 * Find text in document and apply annotation mark
 * Used for annotations created outside the editor (e.g., from chat panel)
 */
export function applyAnnotationMarkByText(
  editor: Editor,
  options: { id: string; color: string; type?: string; text: string }
): boolean {
  const { doc } = editor.state;
  const searchText = options.text.trim();

  // Normalize whitespace for comparison
  const normalizeText = (t: string) => t.replace(/\s+/g, ' ').trim();
  const normalizedSearch = normalizeText(searchText);

  // Find the text position in the document
  let foundPos: { from: number; to: number } | null = null;

  doc.descendants((node, pos) => {
    if (foundPos) return false; // Stop if already found

    if (node.isTextblock) {
      const blockText = node.textContent;
      const normalizedBlock = normalizeText(blockText);
      const index = normalizedBlock.indexOf(normalizedSearch);

      if (index !== -1) {
        // Map the normalized index back to actual positions
        // This is approximate but works for most cases
        let charCount = 0;
        let startPos = pos + 1; // +1 for the node itself
        let foundStart = false;

        node.forEach((child, offset) => {
          if (foundPos) return;

          if (child.isText && child.text) {
            const childText = child.text;
            for (let i = 0; i < childText.length; i++) {
              if (!foundStart && charCount >= index) {
                startPos = pos + 1 + offset + i;
                foundStart = true;
              }
              if (foundStart && charCount >= index + normalizedSearch.length) {
                foundPos = { from: startPos, to: pos + 1 + offset + i };
                return;
              }
              if (!/\s/.test(childText[i]) || charCount === 0 || !/\s/.test(normalizedBlock[charCount - 1])) {
                charCount++;
              }
            }
          }
        });

        // If we found start but not end, the text extends to end of block
        if (foundStart && !foundPos) {
          foundPos = { from: startPos, to: pos + 1 + node.content.size };
        }
      }
    }
  });

  if (!foundPos) {
    console.warn('[applyAnnotationMarkByText] Could not find text:', searchText.substring(0, 50));
    return false;
  }

  // Apply the mark at the found position
  return editor
    .chain()
    .setTextSelection(foundPos)
    .setAnnotation({ id: options.id, color: options.color, type: options.type })
    .setTextSelection(foundPos.to) // Deselect
    .run();
}

/**
 * Remove an annotation mark by ID
 */
export function removeAnnotationMark(editor: Editor, id: string): boolean {
  return editor.commands.removeAnnotation(id);
}

/**
 * Get all annotation marks in the document
 */
export function getAnnotationMarks(editor: Editor): AnnotationPosition[] {
  const annotations: AnnotationPosition[] = [];
  const { doc } = editor.state;
  const markType = editor.schema.marks.annotation;

  if (!markType) return annotations;

  doc.descendants((node, pos) => {
    if (node.isText) {
      for (const mark of node.marks) {
        if (mark.type === markType && mark.attrs.id) {
          // Check if we already have this annotation (avoid duplicates from split nodes)
          const existing = annotations.find((a) => a.id === mark.attrs.id);
          if (existing) {
            // Extend the existing annotation's range
            existing.to = pos + node.nodeSize;
            existing.text += node.text || '';
          } else {
            annotations.push({
              id: mark.attrs.id,
              color: mark.attrs.color || 'yellow',
              from: pos,
              to: pos + node.nodeSize,
              text: node.text || '',
            });
          }
        }
      }
    }
  });

  return annotations;
}

/**
 * Get the text content for a specific annotation mark
 */
export function getAnnotationText(editor: Editor, id: string): string | null {
  const annotations = getAnnotationMarks(editor);
  const annotation = annotations.find((a) => a.id === id);
  return annotation?.text || null;
}

/**
 * Check if an annotation mark exists in the document
 */
export function hasAnnotationMark(editor: Editor, id: string): boolean {
  const annotations = getAnnotationMarks(editor);
  return annotations.some((a) => a.id === id);
}

/**
 * Get the position range of an annotation mark
 */
export function getAnnotationPosition(
  editor: Editor,
  id: string
): { from: number; to: number } | null {
  const annotations = getAnnotationMarks(editor);
  const annotation = annotations.find((a) => a.id === id);
  return annotation ? { from: annotation.from, to: annotation.to } : null;
}

/**
 * Scroll to and select an annotation mark
 */
export function scrollToAnnotation(editor: Editor, id: string): boolean {
  const position = getAnnotationPosition(editor, id);
  if (!position) return false;

  editor
    .chain()
    .focus()
    .setTextSelection({ from: position.from, to: position.to })
    .scrollIntoView()
    .run();

  return true;
}

/**
 * Get the selected text from the editor
 */
export function getSelectedText(editor: Editor): string {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, ' ');
}

/**
 * Check if there is a text selection
 */
export function hasSelection(editor: Editor): boolean {
  return !editor.state.selection.empty;
}

/**
 * Get the current selection range
 */
export function getSelectionRange(
  editor: Editor
): { from: number; to: number } | null {
  if (editor.state.selection.empty) return null;
  const { from, to } = editor.state.selection;
  return { from, to };
}

/**
 * Update the color of an existing annotation mark
 */
export function updateAnnotationColor(
  editor: Editor,
  id: string,
  newColor: string
): boolean {
  const position = getAnnotationPosition(editor, id);
  if (!position) return false;

  // Remove the old mark and add a new one with the updated color
  editor.commands.removeAnnotation(id);
  return editor
    .chain()
    .setTextSelection(position)
    .setAnnotation({ id, color: newColor })
    .run();
}
