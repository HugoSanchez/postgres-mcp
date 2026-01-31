'use client';

import { useRef, useState, useCallback, useEffect, useMemo, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquareText, MessageCircle, Bookmark, StickyNote } from 'lucide-react';
import { SelectionPopover } from './selection-popover';
import { applyHighlightsAndAnnotations } from '@/lib/epub/apply-highlights';
import type { HighlightRow, HighlightColor, AnnotationRow } from '@/lib/db/types';

interface AnnotationMarker {
  id: string;
  type: string;
  top: number;
  rightOffset: number; // Horizontal offset to prevent overlapping markers
  annotation: AnnotationRow;
}

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
  annotations?: AnnotationRow[];
  onCreateHighlight?: (data: {
    startOffset: number;
    endOffset: number;
    selectedText: string;
    color: HighlightColor;
  }) => Promise<void>;
  onAskAI?: (data: { selectedText: string; startOffset: number; endOffset: number }) => void;
  onAddToNotes?: (data: { selectedText: string; startOffset: number; endOffset: number }) => void;
  onAnnotationClick?: (annotation: AnnotationRow) => void;
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
  annotations = [],
  onCreateHighlight,
  onAskAI,
  onAddToNotes,
  onAnnotationClick,
}: EpubChapterProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const pendingHighlightRef = useRef<PendingHighlight | null>(null);
  const lastAppliedHtmlRef = useRef<string>('');
  const skipNextHtmlUpdateRef = useRef(false);
  const [popoverData, setPopoverData] = useState<{ x: number; y: number } | null>(null);
  const [isCreatingHighlight, setIsCreatingHighlight] = useState(false);
  const isSelectingRef = useRef(false);
  const [annotationMarkers, setAnnotationMarkers] = useState<AnnotationMarker[]>([]);

  // Pre-process HTML with highlights and annotations applied
  const htmlWithHighlights = useMemo(() => {
    return applyHighlightsAndAnnotations(html, highlights, annotations);
  }, [html, highlights, annotations]);

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

  // Calculate annotation marker positions after DOM updates
  useLayoutEffect(() => {
    const container = contentRef.current;
    const article = articleRef.current;
    if (!container || !article || annotations.length === 0) {
      setAnnotationMarkers([]);
      return;
    }

    // Wait a tick for DOM to be fully updated
    requestAnimationFrame(() => {
      const articleRect = article.getBoundingClientRect();
      const rawMarkers: Array<{ id: string; type: string; top: number; annotation: AnnotationRow }> = [];

      for (const annotation of annotations) {
        const element = container.querySelector(`[data-annotation-id="${annotation.id}"]`);
        if (element) {
          const rect = element.getBoundingClientRect();
          // Calculate top position relative to the article container
          const top = rect.top - articleRect.top;
          rawMarkers.push({
            id: annotation.id,
            type: annotation.type,
            top,
            annotation,
          });
        }
      }

      // Sort by top position
      rawMarkers.sort((a, b) => a.top - b.top);

      // Calculate horizontal offsets for overlapping markers
      const MARKER_HEIGHT = 32; // Approximate height of marker button
      const HORIZONTAL_OFFSET = 36; // Offset for each additional marker
      const markers: AnnotationMarker[] = [];

      for (let i = 0; i < rawMarkers.length; i++) {
        const current = rawMarkers[i];
        let rightOffset = 0;

        // Check how many markers before this one are at a similar vertical position
        for (let j = 0; j < i; j++) {
          const other = rawMarkers[j];
          if (Math.abs(current.top - other.top) < MARKER_HEIGHT) {
            rightOffset += HORIZONTAL_OFFSET;
          }
        }

        markers.push({
          ...current,
          rightOffset,
        });
      }

      setAnnotationMarkers(markers);
    });
  }, [annotations, htmlWithHighlights]);

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

  // Handle clicks on annotation elements
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !onAnnotationClick) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const annotationElement = target.closest('[data-annotation-id]');
      if (annotationElement) {
        const annotationId = annotationElement.getAttribute('data-annotation-id');
        const annotation = annotations.find(a => a.id === annotationId);
        if (annotation) {
          e.preventDefault();
          e.stopPropagation();
          onAnnotationClick(annotation);
        }
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [annotations, onAnnotationClick]);

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

  const handleAskAI = useCallback(() => {
    const pending = pendingHighlightRef.current;
    if (!pending || !onAskAI) return;

    const { text, startOffset, endOffset } = pending;
    // Remove the pending mark since we're not highlighting
    removePendingMark();
    setPopoverData(null);
    onAskAI({ selectedText: text, startOffset, endOffset });
  }, [onAskAI, removePendingMark]);

  const handleAddToNotes = useCallback(() => {
    const pending = pendingHighlightRef.current;
    if (!pending || !onAddToNotes) return;

    const { text, startOffset, endOffset } = pending;
    // Remove the pending mark since we're not highlighting
    removePendingMark();
    setPopoverData(null);
    onAddToNotes({ selectedText: text, startOffset, endOffset });
  }, [onAddToNotes, removePendingMark]);

  // Get icon component for annotation type
  const getAnnotationIcon = (type: string) => {
    switch (type) {
      case 'qa':
        return MessageSquareText;
      case 'comment':
        return MessageCircle;
      case 'marker':
        return Bookmark;
      case 'note-quote':
        return StickyNote;
      default:
        return MessageSquareText;
    }
  };

  // Get color classes for annotation type
  const getAnnotationColors = (type: string) => {
    if (type === 'note-quote') {
      return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800';
    }
    return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 border-orange-200 dark:border-orange-800';
  };

  // Get title for annotation type
  const getAnnotationTitle = (type: string) => {
    switch (type) {
      case 'qa':
        return 'Q&A annotation';
      case 'comment':
        return 'Comment';
      case 'marker':
        return 'Marker';
      case 'note-quote':
        return 'Quoted in notes';
      default:
        return 'Annotation';
    }
  };

  return (
    <motion.article
      ref={articleRef}
      className={`epub-chapter relative ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div
        ref={contentRef}
        className="
          font-serif prose prose-lg dark:prose-invert max-w-none
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

      {/* Annotation margin markers - only visible on larger screens with margin space */}
      {annotationMarkers.length > 0 && (
        <div className="hidden xl:block absolute top-0 right-0 h-full pointer-events-none">
          {annotationMarkers.map((marker) => {
            const Icon = getAnnotationIcon(marker.type);
            return (
              <button
                key={marker.id}
                type="button"
                onClick={() => onAnnotationClick?.(marker.annotation)}
                className={`absolute pointer-events-auto p-1.5 rounded-full hover:scale-110 transition-all shadow-sm border ${getAnnotationColors(marker.type)}`}
                style={{
                  top: marker.top - 4,
                  right: -48 - marker.rightOffset, // Base offset + additional offset for overlapping markers
                }}
                title={getAnnotationTitle(marker.type)}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      )}

      {popoverData && (
        <SelectionPopover
          position={popoverData}
          onSelectColor={handleSelectColor}
          onAskAI={handleAskAI}
          onAddToNotes={handleAddToNotes}
          onClose={handleClosePopover}
          isLoading={isCreatingHighlight}
        />
      )}
    </motion.article>
  );
}
