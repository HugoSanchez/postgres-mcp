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
 * Wrap a Range with <mark> elements.
 * For ranges spanning multiple elements, wraps each text node individually
 * to avoid corrupting the DOM structure.
 */
function wrapRangeWithMark(
  doc: Document,
  range: Range,
  color: string,
  highlightId: string
): void {
  // If the range is within a single text node, use the simple approach
  if (
    range.startContainer === range.endContainer &&
    range.startContainer.nodeType === Node.TEXT_NODE
  ) {
    const mark = doc.createElement('mark');
    mark.className = `highlight highlight-${color}`;
    mark.setAttribute('data-highlight-id', highlightId);
    range.surroundContents(mark);
    return;
  }

  // For ranges spanning multiple elements, wrap each text node individually
  // First, collect all text nodes within the range
  const textNodes: Array<{ node: Text; start: number; end: number }> = [];
  const walker = doc.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node = walker.nextNode() as Text | null;
  while (node) {
    // Check if this text node is within the range
    const nodeRange = doc.createRange();
    nodeRange.selectNodeContents(node);

    const startsBeforeEnd = range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0;
    const endsAfterStart = range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0;

    if (startsBeforeEnd && endsAfterStart) {
      // This node overlaps with our range
      const nodeLength = node.textContent?.length || 0;

      // Calculate the portion of this node to highlight
      let start = 0;
      let end = nodeLength;

      if (node === range.startContainer) {
        start = range.startOffset;
      }
      if (node === range.endContainer) {
        end = range.endOffset;
      }

      if (start < end && end <= nodeLength) {
        textNodes.push({ node, start, end });
      }
    }

    node = walker.nextNode() as Text | null;
  }

  // Wrap each text node portion (process in reverse to preserve offsets)
  for (let i = textNodes.length - 1; i >= 0; i--) {
    const { node, start, end } = textNodes[i];
    const nodeLength = node.textContent?.length || 0;

    // Skip empty portions
    if (start >= end || start >= nodeLength) continue;

    const mark = doc.createElement('mark');
    mark.className = `highlight highlight-${color}`;
    mark.setAttribute('data-highlight-id', highlightId);

    // Split the text node if necessary and wrap the middle part
    if (start > 0 || end < nodeLength) {
      // We need to split the text node
      const textContent = node.textContent || '';

      // Create the parts
      const beforeText = textContent.slice(0, start);
      const highlightText = textContent.slice(start, end);
      const afterText = textContent.slice(end);

      // Create new nodes
      const parent = node.parentNode;
      if (!parent) continue;

      // Build replacement nodes
      const fragment = doc.createDocumentFragment();

      if (beforeText) {
        fragment.appendChild(doc.createTextNode(beforeText));
      }

      mark.textContent = highlightText;
      fragment.appendChild(mark);

      if (afterText) {
        fragment.appendChild(doc.createTextNode(afterText));
      }

      // Replace the original text node
      parent.replaceChild(fragment, node);
    } else {
      // Wrap the entire text node
      const parent = node.parentNode;
      if (!parent) continue;

      mark.textContent = node.textContent;
      parent.replaceChild(mark, node);
    }
  }
}
