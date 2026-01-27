import type { HighlightRow, EpubHighlightAnchor } from '@/lib/db/types';

/**
 * Apply highlights to chapter HTML by parsing it as DOM, applying highlights,
 * and serializing back to HTML. This properly handles HTML entities.
 */
export function applyHighlights(
  html: string,
  highlights: HighlightRow[]
): string {
  if (!highlights.length) return html;

  // Parse HTML into a DOM tree
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstChild as HTMLElement;

  if (!container) return html;

  // Sort highlights by start offset (process in reverse to preserve positions)
  const sortedHighlights = [...highlights].sort((a, b) => {
    const anchorA = a.anchor as EpubHighlightAnchor;
    const anchorB = b.anchor as EpubHighlightAnchor;
    return anchorB.startOffset - anchorA.startOffset;
  });

  // Apply each highlight
  for (const highlight of sortedHighlights) {
    const anchor = highlight.anchor as EpubHighlightAnchor;

    try {
      const range = findRangeByOffset(container, anchor.startOffset, anchor.endOffset);
      if (range) {
        wrapRangeWithMark(doc, range, highlight.color, highlight.id);
      }
    } catch (error) {
      console.warn('Failed to apply highlight:', error);
    }
  }

  // Serialize back to HTML
  return container.innerHTML;
}

/**
 * Find a Range object by character offsets within a container.
 */
function findRangeByOffset(
  container: HTMLElement,
  startOffset: number,
  endOffset: number
): Range | null {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  let currentOffset = 0;
  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;

  let node = walker.nextNode() as Text | null;

  while (node) {
    const nodeLength = node.textContent?.length || 0;
    const nodeEnd = currentOffset + nodeLength;

    // Check if start falls within this node
    if (!startNode && startOffset >= currentOffset && startOffset < nodeEnd) {
      startNode = node;
      startNodeOffset = startOffset - currentOffset;
    }

    // Check if end falls within this node
    if (endOffset >= currentOffset && endOffset <= nodeEnd) {
      endNode = node;
      endNodeOffset = endOffset - currentOffset;
      break;
    }

    currentOffset = nodeEnd;
    node = walker.nextNode() as Text | null;
  }

  if (!startNode || !endNode) {
    return null;
  }

  // Get the owner document from the container to create the range
  const ownerDoc = container.ownerDocument;
  const range = ownerDoc.createRange();
  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);
  return range;
}

/**
 * Wrap a Range with a <mark> element.
 */
function wrapRangeWithMark(
  doc: Document,
  range: Range,
  color: string,
  highlightId: string
): void {
  const mark = doc.createElement('mark');
  mark.className = `highlight highlight-${color}`;
  mark.setAttribute('data-highlight-id', highlightId);

  try {
    range.surroundContents(mark);
  } catch {
    // If surroundContents fails (spans multiple elements), use extractContents
    const fragment = range.extractContents();
    mark.appendChild(fragment);
    range.insertNode(mark);
  }
}
