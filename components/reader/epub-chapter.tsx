'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Quote, MessageSquare } from 'lucide-react';
import { type Editor } from '@tiptap/react';
import { TipTapRenderer } from './tiptap-renderer';
import { SelectionToolbar, type AnnotationColor } from './selection-toolbar';
import { applyAnnotationMark, applyAnnotationMarkByText, getSelectedText, hasAnnotationMark } from '@/lib/tiptap/annotation-helpers';
import type { TipTapDocument } from '@/lib/tiptap/html-to-json';
import type { Annotation } from '@/lib/db/schema';

// Track position for margin indicators
// Groups multiple annotations with same selectedText into one indicator
interface MarginIndicator {
  annotationIds: string[]; // All annotation IDs for this text
  selectedText: string;
  type: 'ai-response' | 'quote' | 'comment';
  top: number;
  rightOffset: number; // Calculated offset when multiple indicators at same position
}

interface EpubChapterProps {
  title: string;
  content: TipTapDocument;
  sectionIndex: number;
  documentId: string;
  className?: string;
  annotations?: Annotation[];
  onAnnotationCreated?: (annotation: Annotation) => void;
  onAnnotationClick?: (annotation: Annotation, position: { x: number; y: number }) => void;
  onMultiAnnotationClick?: (annotations: Annotation[], position: { x: number; y: number }) => void;
  onAskAI?: (data: { selectedText: string; sectionIndex: number }) => void;
  onAddToNotes?: (data: { selectedText: string; sectionIndex: number; annotationId: string }) => void;
  onContentChange?: (content: TipTapDocument) => void;
}

/**
 * Renders a single document section with TipTap content and annotation support
 */
export function EpubChapter({
  title,
  content,
  sectionIndex,
  documentId,
  className = '',
  annotations = [],
  onAnnotationCreated,
  onAnnotationClick,
  onMultiAnnotationClick,
  onAskAI,
  onAddToNotes,
  onContentChange,
}: EpubChapterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [allIndicators, setAllIndicators] = useState<MarginIndicator[]>([]);

  // Track which annotations have been synced to prevent duplicate processing
  const syncedAnnotationsRef = useRef<Set<string>>(new Set());

  // Handle editor ready
  const handleEditorReady = useCallback((editorInstance: Editor) => {
    setEditor(editorInstance);
  }, []);

  // Sync annotations from database to editor marks
  // This handles annotations created outside the editor (e.g., from chat panel)
  useEffect(() => {
    if (!editor || annotations.length === 0) return;

    let hasChanges = false;

    for (const annotation of annotations) {
      // Skip if already synced
      if (syncedAnnotationsRef.current.has(annotation.id)) {
        continue;
      }

      // Check if this annotation already has a mark in the editor
      if (!hasAnnotationMark(editor, annotation.id)) {
        // Apply the mark by finding the text
        const applied = applyAnnotationMarkByText(editor, {
          id: annotation.id,
          color: annotation.color,
          type: annotation.type,
          text: annotation.selectedText,
        });

        if (applied) {
          hasChanges = true;
        }
      }

      // Mark as synced regardless of whether we applied (might already exist in content)
      syncedAnnotationsRef.current.add(annotation.id);
    }

    // Persist content changes if marks were added
    if (hasChanges && onContentChange) {
      onContentChange(editor.getJSON() as TipTapDocument);
    }
  }, [editor, annotations, onContentChange]);

  // Update margin indicator positions for all annotation types
  // Groups annotations by type and selectedText, calculates horizontal offset for collisions
  useEffect(() => {
    if (!containerRef.current) return;

    const updateAllIndicatorPositions = () => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const indicatorTypes: Array<'ai-response' | 'quote' | 'comment'> = ['ai-response', 'quote', 'comment'];
      const allIndicatorsTemp: MarginIndicator[] = [];

      // Create indicators for each type
      for (const type of indicatorTypes) {
        const typeAnnotations = annotations.filter(a => a.type === type);

        // Group annotations by selectedText
        const groupedByText = new Map<string, typeof typeAnnotations>();
        for (const annotation of typeAnnotations) {
          const existing = groupedByText.get(annotation.selectedText) || [];
          existing.push(annotation);
          groupedByText.set(annotation.selectedText, existing);
        }

        // Create one indicator per unique selectedText for this type
        for (const [selectedText, group] of groupedByText) {
          const firstAnnotation = group[0];
          const markElement = containerRef.current?.querySelector(
            `[data-annotation-id="${firstAnnotation.id}"]`
          );

          if (markElement) {
            const markRect = markElement.getBoundingClientRect();
            const top = markRect.top - containerRect.top + (markRect.height / 2) - 10;
            allIndicatorsTemp.push({
              annotationIds: group.map(a => a.id),
              selectedText,
              type,
              top,
              rightOffset: 0, // Will be calculated below
            });
          }
        }
      }

      // Calculate horizontal offsets for indicators at similar vertical positions
      const COLLISION_THRESHOLD = 15; // pixels - indicators within this range are considered colliding
      const INDICATOR_SPACING = 24; // pixels between indicators

      // Sort by top position for easier collision detection
      allIndicatorsTemp.sort((a, b) => a.top - b.top);

      // Group colliding indicators and assign offsets
      for (let i = 0; i < allIndicatorsTemp.length; i++) {
        const current = allIndicatorsTemp[i];
        const collidingIndicators = [current];

        // Find all indicators that collide with this one
        for (let j = i + 1; j < allIndicatorsTemp.length; j++) {
          const other = allIndicatorsTemp[j];
          if (Math.abs(other.top - current.top) <= COLLISION_THRESHOLD) {
            collidingIndicators.push(other);
          } else {
            break; // Since sorted, no more collisions possible
          }
        }

        // Assign offsets to colliding indicators
        if (collidingIndicators.length > 1) {
          collidingIndicators.forEach((indicator, index) => {
            indicator.rightOffset = index * INDICATOR_SPACING;
          });
          // Skip the ones we already processed
          i += collidingIndicators.length - 1;
        }
      }

      setAllIndicators(allIndicatorsTemp);
    };

    // Initial update
    updateAllIndicatorPositions();

    // Update on window resize
    window.addEventListener('resize', updateAllIndicatorPositions);

    // Also update when content might have changed
    const observer = new MutationObserver(updateAllIndicatorPositions);
    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true });
    }

    return () => {
      window.removeEventListener('resize', updateAllIndicatorPositions);
      observer.disconnect();
    };
  }, [annotations]);

  // Handle annotation click
  const handleAnnotationClick = useCallback(
    (annotationId: string, position: { x: number; y: number }) => {
      const annotation = annotations.find((a) => a.id === annotationId);
      if (annotation && onAnnotationClick) {
        onAnnotationClick(annotation, position);
      }
    },
    [annotations, onAnnotationClick]
  );

  // Create annotation via API
  const createAnnotation = useCallback(
    async (
      type: 'highlight' | 'comment' | 'ai-response' | 'quote',
      color: AnnotationColor,
      content?: Record<string, unknown>
    ): Promise<Annotation | null> => {
      if (!editor) return null;

      const selectedText = getSelectedText(editor);
      if (!selectedText) return null;

      // Generate ID for mark sync
      const id = crypto.randomUUID();

      try {
        // Apply mark to editor first (optimistic update)
        applyAnnotationMark(editor, { id, color, type });

        // Create annotation in database
        const response = await fetch('/api/annotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            documentId,
            sectionIndex,
            type,
            selectedText,
            color,
            content,
          }),
        });

        if (!response.ok) {
          // Rollback mark on failure
          editor.commands.removeAnnotation(id);
          throw new Error('Failed to create annotation');
        }

        const { annotation } = await response.json();

        // Notify parent of content change (for persistence)
        if (onContentChange) {
          onContentChange(editor.getJSON() as TipTapDocument);
        }

        // Notify parent of new annotation
        if (onAnnotationCreated) {
          onAnnotationCreated(annotation);
        }

        return annotation;
      } catch (error) {
        console.error('Failed to create annotation:', error);
        return null;
      }
    },
    [editor, documentId, sectionIndex, onContentChange, onAnnotationCreated]
  );

  // Handle highlight
  const handleHighlight = useCallback(
    async (color: AnnotationColor) => {
      if (isCreating) return;
      setIsCreating(true);
      try {
        await createAnnotation('highlight', color);
      } finally {
        setIsCreating(false);
      }
    },
    [createAnnotation, isCreating]
  );

  // Handle comment - creates annotation and opens comment input
  const handleComment = useCallback(async () => {
    if (isCreating || !editor) return;

    const selectedText = getSelectedText(editor);
    if (!selectedText) return;

    setIsCreating(true);
    try {
      // Get selection position before creating annotation
      const selection = window.getSelection();
      let position = { x: 0, y: 0 };
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        position = { x: rect.left + rect.width / 2, y: rect.top };
      }

      // Create a comment annotation with empty content initially
      // The comment content will be added via update
      const annotation = await createAnnotation('comment', 'blue', { comment: '' });

      // Open comment editor (parent should handle this)
      if (annotation && onAnnotationClick) {
        onAnnotationClick(annotation, position);
      }
    } finally {
      setIsCreating(false);
    }
  }, [createAnnotation, isCreating, editor, onAnnotationClick]);

  // Handle add to notes
  const handleAddToNotes = useCallback(async () => {
    if (isCreating || !editor) return;

    const selectedText = getSelectedText(editor);
    if (!selectedText) return;

    setIsCreating(true);
    try {
      const annotation = await createAnnotation('quote', 'purple');

      if (annotation && onAddToNotes) {
        onAddToNotes({
          selectedText,
          sectionIndex,
          annotationId: annotation.id,
        });
      }
    } finally {
      setIsCreating(false);
    }
  }, [createAnnotation, isCreating, editor, sectionIndex, onAddToNotes]);

  // Handle ask AI
  const handleAskAI = useCallback(() => {
    if (!editor || !onAskAI) return;

    const selectedText = getSelectedText(editor);
    if (!selectedText) return;

    onAskAI({
      selectedText,
      sectionIndex,
    });
  }, [editor, sectionIndex, onAskAI]);

  // Handle margin indicator click - supports multiple annotations for same text
  const handleMarginIndicatorClick = useCallback(
    (annotationIds: string[]) => {
      const matchedAnnotations = annotations.filter(a => annotationIds.includes(a.id));
      if (matchedAnnotations.length === 0) return;

      // Find the mark element to get position
      const markElement = containerRef.current?.querySelector(
        `[data-annotation-id="${annotationIds[0]}"]`
      );
      if (markElement) {
        const rect = markElement.getBoundingClientRect();
        const position = { x: rect.right + 30, y: rect.top };

        if (matchedAnnotations.length === 1 && onAnnotationClick) {
          // Single annotation - use existing handler
          onAnnotationClick(matchedAnnotations[0], position);
        } else if (onMultiAnnotationClick) {
          // Multiple annotations - use new handler
          onMultiAnnotationClick(matchedAnnotations, position);
        } else if (onAnnotationClick) {
          // Fallback to first annotation if multi handler not provided
          onAnnotationClick(matchedAnnotations[0], position);
        }
      }
    },
    [annotations, onAnnotationClick, onMultiAnnotationClick]
  );

  return (
    <motion.article
      ref={containerRef}
      className={`epub-chapter relative ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="font-serif relative">
        <TipTapRenderer
          content={content}
          onEditorReady={handleEditorReady}
          onAnnotationClick={handleAnnotationClick}
        />

        {/* Selection toolbar */}
        <SelectionToolbar
          editor={editor}
          onHighlight={handleHighlight}
          onComment={handleComment}
          onAddToNotes={handleAddToNotes}
          onAskAI={handleAskAI}
        />

        {/* Margin indicators for all annotation types */}
        {allIndicators.map(indicator => {
          const classNames = {
            'ai-response': 'ai-response-margin-indicator',
            'quote': 'quote-margin-indicator',
            'comment': 'comment-margin-indicator',
          };
          const icons = {
            'ai-response': <Sparkles />,
            'quote': <Quote />,
            'comment': <MessageSquare />,
          };
          const titles = {
            'ai-response': indicator.annotationIds.length > 1
              ? `View ${indicator.annotationIds.length} AI responses`
              : 'View AI response',
            'quote': indicator.annotationIds.length > 1
              ? `View ${indicator.annotationIds.length} quotes in notes`
              : 'View quote in notes',
            'comment': indicator.annotationIds.length > 1
              ? `View ${indicator.annotationIds.length} comments`
              : 'View comment',
          };

          return (
            <button
              key={`${indicator.type}-${indicator.annotationIds.join(',')}`}
              type="button"
              className={classNames[indicator.type]}
              style={{
                top: indicator.top,
                right: -32 - indicator.rightOffset,
              }}
              onClick={() => handleMarginIndicatorClick(indicator.annotationIds)}
              title={titles[indicator.type]}
            >
              {icons[indicator.type]}
            </button>
          );
        })}
      </div>
    </motion.article>
  );
}
