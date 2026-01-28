'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { HighlightPopover } from './highlight-popover';
import { applyHighlights } from '@/lib/epub/apply-highlights';
import type { HighlightRow, HighlightColor } from '@/lib/db/types';

interface PendingHighlight {
  startOffset: number;
  endOffset: number;
  text: string;
  markElement: HTMLElement;
  rect: DOMRect;
}

interface EpubChapterProps {
  title: string;
  html: string;
  className?: string;
  highlights?: HighlightRow[];
  onCreateHighlight?: (data: {
    startOffset: number;
    endOffset: number;
    selectedText: string;
    color: HighlightColor;
  }) => Promise<void>;
}

/**
 * Calculate character offset from the start of the container to a given node/offset.
 */
function getCharacterOffset(
  container: HTMLElement,
  targetNode: Node,
  targetOffset: number
): number {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  let offset = 0;
  let node = walker.nextNode();

  while (node) {
    if (node === targetNode) {
      return offset + targetOffset;
    }
    offset += node.textContent?.length || 0;
    node = walker.nextNode();
  }

  return offset;
}

/**
 * Renders a single EPUB chapter with sanitized HTML content
 * Uses Tailwind prose styling for consistent typography
 */
export function EpubChapter({
  title,
  html,
  className = '',
  highlights = [],
  onCreateHighlight,
}: EpubChapterProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const pendingHighlightRef = useRef<PendingHighlight | null>(null);
  const lastAppliedHtmlRef = useRef<string>('');
  const skipNextHtmlUpdateRef = useRef(false);
  const [popoverData, setPopoverData] = useState<{ x: number; y: number } | null>(null);
  const [isCreatingHighlight, setIsCreatingHighlight] = useState(false);
  const isSelectingRef = useRef(false);

  // Pre-process HTML with highlights applied
  const htmlWithHighlights = useMemo(() => {
    return applyHighlights(html, highlights);
  }, [html, highlights]);

  // Set innerHTML manually to avoid React re-renders overwriting our DOM changes
  // Use a ref to track what we last applied, to avoid resetting when we have pending marks
  useEffect(() => {
    if (contentRef.current && htmlWithHighlights !== lastAppliedHtmlRef.current) {
      // Skip the update if we just created a highlight (DOM already has correct visual)
      if (skipNextHtmlUpdateRef.current) {
        skipNextHtmlUpdateRef.current = false;
        lastAppliedHtmlRef.current = htmlWithHighlights;
        return;
      }
      contentRef.current.innerHTML = htmlWithHighlights;
      lastAppliedHtmlRef.current = htmlWithHighlights;
    }
  }, [htmlWithHighlights]);

  // Remove pending highlight mark from DOM
  const removePendingMark = useCallback(() => {
    const pending = pendingHighlightRef.current;
    if (pending?.markElement) {
      const mark = pending.markElement;
      const parent = mark.parentNode;
      if (parent) {
        // Unwrap: move children out and remove the mark
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
      }
    }
    pendingHighlightRef.current = null;
  }, []);

  // Handle mouse events for selection
  // Listen on container for mousedown, but document for mouseup (user may release outside container)
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleMouseDown = () => {
      // Clear any existing pending highlight when starting a new selection
      if (pendingHighlightRef.current) {
        removePendingMark();
        setPopoverData(null);
      }
      isSelectingRef.current = true;
    };

    const handleMouseUp = () => {
      if (!isSelectingRef.current) return;
      isSelectingRef.current = false;

      const windowSelection = window.getSelection();
      if (!windowSelection || windowSelection.isCollapsed) {
        return;
      }

      const range = windowSelection.getRangeAt(0);

      // Check if selection is within our container
      if (!container.contains(range.commonAncestorContainer)) {
        return;
      }

      const text = windowSelection.toString().trim();
      if (!text) {
        return;
      }

      // Calculate character offsets
      const startOffset = getCharacterOffset(
        container,
        range.startContainer,
        range.startOffset
      );
      const endOffset = getCharacterOffset(
        container,
        range.endContainer,
        range.endOffset
      );

      // Get bounding rect for popover positioning
      const rect = range.getBoundingClientRect();

      // Create a temporary mark element with pending style
      const mark = document.createElement('mark');
      mark.className = 'highlight highlight-pending';

      try {
        range.surroundContents(mark);
      } catch {
        // If surroundContents fails (spans multiple elements), use extractContents
        const fragment = range.extractContents();
        mark.appendChild(fragment);
        range.insertNode(mark);
      }

      // Clear the native selection
      windowSelection.removeAllRanges();

      // Store the pending highlight in ref (no re-render)
      pendingHighlightRef.current = {
        startOffset,
        endOffset,
        text,
        markElement: mark,
        rect,
      };

      // Show popover (triggers re-render, but innerHTML is set via useEffect now)
      setPopoverData({
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    };

    container.addEventListener('mousedown', handleMouseDown);
    // Listen on document for mouseup to catch selections that end outside the container
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [removePendingMark]);

  const handleSelectColor = useCallback(
    async (color: HighlightColor) => {
      const pending = pendingHighlightRef.current;
      if (!pending || !onCreateHighlight) return;

      setIsCreatingHighlight(true);
      try {
        // Update the mark's class to the selected color
        pending.markElement.className = `highlight highlight-${color}`;

        await onCreateHighlight({
          startOffset: pending.startOffset,
          endOffset: pending.endOffset,
          selectedText: pending.text,
          color,
        });

        // Skip the next HTML update since DOM already has the correct visual
        skipNextHtmlUpdateRef.current = true;
        // Clear pending (the real highlight will come from re-fetch)
        pendingHighlightRef.current = null;
        setPopoverData(null);
      } catch (error) {
        console.error('Failed to create highlight:', error);
        // On error, remove the pending mark
        removePendingMark();
        setPopoverData(null);
      } finally {
        setIsCreatingHighlight(false);
      }
    },
    [onCreateHighlight, removePendingMark]
  );

  const handleClosePopover = useCallback(() => {
    removePendingMark();
    setPopoverData(null);
  }, [removePendingMark]);

  return (
    <motion.article
      className={`epub-chapter ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div
        ref={contentRef}
        className="
          prose prose-lg dark:prose-invert max-w-none
          prose-headings:font-semibold
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-img:rounded-lg prose-img:shadow-md prose-img:mx-auto
          prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r
          prose-pre:bg-muted prose-pre:text-foreground
          prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
          prose-hr:border-border
          [&_.epub-chapter]:mb-0
          [&_section]:mb-8
          [&_aside]:border-l-2 [&_aside]:border-muted-foreground/30 [&_aside]:pl-4 [&_aside]:italic [&_aside]:text-muted-foreground
          [&_table:not(:has(thead))]:block
          [&_table:not(:has(thead))_tbody]:block
          [&_table:not(:has(thead))_tr]:block
          [&_table:not(:has(thead))_td]:block
          [&_table:not(:has(thead))_td]:!border-none
          [&_table:not(:has(thead))_td]:!p-0
          [&_table:not(:has(thead))_td]:whitespace-nowrap
        "
      />

      {popoverData && onCreateHighlight && (
        <HighlightPopover
          position={popoverData}
          onSelectColor={handleSelectColor}
          onClose={handleClosePopover}
          isLoading={isCreatingHighlight}
        />
      )}
    </motion.article>
  );
}
