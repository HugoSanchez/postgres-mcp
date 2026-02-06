'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { BookOpen, List, X } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { EpubChapter } from './epub-chapter';
import { CommentPopover } from './comment-popover';
import { SidePanel } from './side-panel';
import { MobilePanel } from './mobile-panel';
import { SidebarToggle } from '../sidebar-toggle';
import { useSidebar } from '../ui/sidebar';
import { LineSpinner } from '../ui/line-spinner';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type {
  HighlightRow,
  HighlightColor,
  EpubHighlightAnchor,
  AnnotationRow,
} from '@/lib/db/types';

interface ChapterMeta {
  id: string;
  spineIndex: number;
  href: string;
  title: string;
}

interface ChapterContent extends ChapterMeta {
  html: string;
  text: string;
}

interface OutlineItem {
  id: string;
  title: string;
  pageIndex: number;
  order: number;
}

interface EpubDocument {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  blobUrl: string;
  chapterCount: number;
  createdAt: string;
}

interface EpubReaderProps {
  documentId: string;
  initialChapter?: number;
  initialScrollPosition?: number;
  fromUpload?: boolean;
  documentType?: 'epub' | 'article' | 'pdf';
  onClose: () => void;
  onChapterChange?: (spineIndex: number) => void;
  onProgressChange?: (spineIndex: number, scrollPosition: number) => void;
}

export function EpubReader({
  documentId,
  initialChapter = 0,
  initialScrollPosition = 0,
  fromUpload = false,
  documentType = 'epub',
  onClose,
  onChapterChange,
  onProgressChange,
}: EpubReaderProps) {
  // Document metadata
  const [epubDoc, setEpubDoc] = useState<EpubDocument | null>(null);
  const [chapters, setChapters] = useState<ChapterMeta[]>([]);
  const [outline, setOutline] = useState<OutlineItem[]>([]);

  // Loaded chapters (for infinite scroll)
  const [loadedChapters, setLoadedChapters] = useState<
    Map<number, ChapterContent>
  >(new Map());
  const [visibleChapterIndices, setVisibleChapterIndices] = useState<number[]>(
    [],
  );
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);

  // Loading states
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Highlights state (per chapter)
  const [highlightsByChapter, setHighlightsByChapter] = useState<
    Map<number, HighlightRow[]>
  >(new Map());

  // Annotations state (per chapter)
  const [annotationsByChapter, setAnnotationsByChapter] = useState<
    Map<number, AnnotationRow[]>
  >(new Map());

  // Scroll tracking
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const shouldRestoreScroll = useRef(initialScrollPosition > 0);
  const hasRestoredScroll = useRef(false);
  const hasSentInitialProgress = useRef(false);

  // Side panel state
  const isMobile = useIsMobile();
  const { open } = useSidebar();
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('chat');
  const [chatContext, setChatContext] = useState('');
  const [chatContextAnchor, setChatContextAnchor] =
    useState<EpubHighlightAnchor | null>(null);
  const [notes, setNotes] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [seedMessages, setSeedMessages] = useState<{
    question: string;
    answer: string;
  } | null>(null);
  const [scrollToQuoteText, setScrollToQuoteText] = useState<string | null>(
    null,
  );
  const [activeComment, setActiveComment] = useState<{
    annotation: AnnotationRow;
    position: { x: number; y: number };
  } | null>(null);
  const saveNotesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedNotesRef = useRef<string>('');
  const notesRef = useRef<string>('');
  const noteIdRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    noteIdRef.current = noteId;
  }, [noteId]);

  // Fetch document metadata and chapter list
  useEffect(() => {
    async function fetchDocument() {
      setIsLoadingDoc(true);
      setError(null);

      try {
        const res = await fetch(`/api/reader/epub/${documentId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load document');
        }

        const data = await res.json();
        setEpubDoc(data.document);
        setChapters(data.chapters);
        setOutline(data.outline);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load document',
        );
      } finally {
        setIsLoadingDoc(false);
      }
    }

    fetchDocument();
  }, [documentId]);

  // Fetch notes on mount
  useEffect(() => {
    async function fetchNotes() {
      try {
        const res = await fetch(
          `/api/reader/notes?documentId=${documentId}&documentType=${documentType}`,
        );
        if (res.ok) {
          const data = await res.json();
          setNoteId(data.note.id);
          setNotes(data.note.content || '');
        }
      } catch (err) {
        console.error('Failed to fetch notes:', err);
      }
    }

    fetchNotes();
  }, [documentId]);

  // Save notes with debouncing
  useEffect(() => {
    if (!noteId) return;

    // Clear previous timeout
    if (saveNotesTimeoutRef.current) {
      clearTimeout(saveNotesTimeoutRef.current);
    }

    // Debounce save by 1 second
    saveNotesTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/reader/notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ noteId, content: notes }),
        });
        lastSavedNotesRef.current = notes;
      } catch (err) {
        console.error('Failed to save notes:', err);
      }
    }, 1000);

    return () => {
      if (saveNotesTimeoutRef.current) {
        clearTimeout(saveNotesTimeoutRef.current);
      }
    };
  }, [notes, noteId]);

  // Immediate save function (for panel close and page unload)
  const saveNotesImmediately = useCallback(() => {
    const currentNoteId = noteIdRef.current;
    const currentNotes = notesRef.current;

    // Skip if no note or nothing has changed since last save
    if (!currentNoteId || currentNotes === lastSavedNotesRef.current) return;

    // Clear any pending debounced save
    if (saveNotesTimeoutRef.current) {
      clearTimeout(saveNotesTimeoutRef.current);
      saveNotesTimeoutRef.current = null;
    }

    // Use sendBeacon for reliable delivery even during page unload
    const blob = new Blob(
      [JSON.stringify({ noteId: currentNoteId, content: currentNotes })],
      { type: 'application/json' },
    );
    navigator.sendBeacon('/api/reader/notes', blob);
    lastSavedNotesRef.current = currentNotes;
  }, []);

  // Save on page unload/visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveNotesImmediately();
      }
    };

    const handleBeforeUnload = () => {
      saveNotesImmediately();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveNotesImmediately]);

  // Handle panel open/close - save immediately when closing
  const handlePanelOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Panel is closing - save immediately
        saveNotesImmediately();
      }
      setPanelOpen(open);
    },
    [saveNotesImmediately],
  );

  const getSpineIndexForPosition = useCallback(
    (position: number) => chapters[position]?.spineIndex ?? 0,
    [chapters],
  );

  // Fetch highlights for a chapter
  const fetchHighlights = useCallback(
    async (spineIndex: number) => {
      try {
        const res = await fetch(
          `/api/reader/highlights?documentId=${documentId}&chapterIndex=${spineIndex}`,
        );
        if (res.ok) {
          const data = await res.json();
          setHighlightsByChapter((prev) => {
            const next = new Map(prev);
            next.set(spineIndex, data.highlights || []);
            return next;
          });
        }
      } catch (err) {
        console.error('Failed to fetch highlights:', err);
      }
    },
    [documentId],
  );

  // Fetch annotations for a chapter
  const fetchAnnotations = useCallback(
    async (spineIndex: number) => {
      try {
        const res = await fetch(
          `/api/reader/annotations?documentId=${documentId}&chapterIndex=${spineIndex}`,
        );
        if (res.ok) {
          const data = await res.json();
          setAnnotationsByChapter((prev) => {
            const next = new Map(prev);
            next.set(spineIndex, data.annotations || []);
            return next;
          });
        }
      } catch (err) {
        console.error('Failed to fetch annotations:', err);
      }
    },
    [documentId],
  );

  // Fetch chapter content (position-based, but API expects spineIndex)
  const fetchChapter = useCallback(
    async (position: number): Promise<ChapterContent | null> => {
      // Return cached chapter if available
      const cached = loadedChapters.get(position);
      if (cached) return cached;

      const chapterMeta = chapters[position];
      if (!chapterMeta) return null;

      try {
        const res = await fetch(
          `/api/reader/epub/${documentId}?chapter=${chapterMeta.spineIndex}`,
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load chapter');
        }

        const data = await res.json();
        const chapter = data.chapter as ChapterContent;

        // Cache the chapter
        setLoadedChapters((prev) => {
          const next = new Map(prev);
          next.set(position, chapter);
          return next;
        });

        // Fetch highlights and annotations for this chapter
        fetchHighlights(chapterMeta.spineIndex);
        fetchAnnotations(chapterMeta.spineIndex);

        return chapter;
      } catch (err) {
        console.error('Failed to load chapter:', err);
        return null;
      }
    },
    [documentId, loadedChapters, fetchHighlights, fetchAnnotations, chapters],
  );

  // Load initial chapter when document is loaded
  useEffect(() => {
    if (chapters.length > 0 && visibleChapterIndices.length === 0) {
      const desiredPosition = chapters.findIndex(
        (ch) => ch.spineIndex === initialChapter,
      );
      const startChapter = desiredPosition >= 0 ? desiredPosition : 0;
      setIsLoadingMore(true);
      fetchChapter(startChapter).then(() => {
        setVisibleChapterIndices([startChapter]);
        setCurrentChapterIndex(startChapter);
        onChapterChange?.(getSpineIndexForPosition(startChapter));
        setIsLoadingMore(false);
      });
    }
  }, [
    chapters,
    visibleChapterIndices.length,
    fetchChapter,
    initialChapter,
    onChapterChange,
    getSpineIndexForPosition,
  ]);

  // Seed initial progress so new reads appear in the sidebar
  useEffect(() => {
    if (!onProgressChange || hasSentInitialProgress.current) return;
    if (visibleChapterIndices.length === 0) return;

    const spineIndex = getSpineIndexForPosition(currentChapterIndex);
    onProgressChange(spineIndex, initialScrollPosition);
    hasSentInitialProgress.current = true;
  }, [
    onProgressChange,
    visibleChapterIndices.length,
    currentChapterIndex,
    initialScrollPosition,
    getSpineIndexForPosition,
  ]);

  // Load more chapters when scrolling near bottom (intersection observer)
  useEffect(() => {
    const trigger = loadMoreTriggerRef.current;
    if (!trigger) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry.isIntersecting &&
          !isLoadingMore &&
          visibleChapterIndices.length > 0
        ) {
          const lastVisibleIndex =
            visibleChapterIndices[visibleChapterIndices.length - 1];
          const nextIndex = lastVisibleIndex + 1;

          if (nextIndex < chapters.length) {
            setIsLoadingMore(true);
            fetchChapter(nextIndex).then((chapter) => {
              if (chapter) {
                setVisibleChapterIndices((prev) => [...prev, nextIndex]);
              }
              setIsLoadingMore(false);
            });
          }
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(trigger);
    return () => observer.disconnect();
  }, [chapters.length, visibleChapterIndices, isLoadingMore, fetchChapter]);

  // Track current chapter based on scroll position
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Find which chapter is most visible
      let mostVisibleIndex = visibleChapterIndices[0] ?? 0;
      let maxVisibleArea = 0;

      for (const index of visibleChapterIndices) {
        const el = chapterRefs.current.get(index);
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Calculate visible area of this chapter
        const visibleTop = Math.max(rect.top, containerRect.top);
        const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);

        if (visibleHeight > maxVisibleArea) {
          maxVisibleArea = visibleHeight;
          mostVisibleIndex = index;
        }
      }

      if (mostVisibleIndex !== currentChapterIndex) {
        setCurrentChapterIndex(mostVisibleIndex);
        onChapterChange?.(getSpineIndexForPosition(mostVisibleIndex));
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [
    visibleChapterIndices,
    currentChapterIndex,
    onChapterChange,
    getSpineIndexForPosition,
  ]);

  // Navigation handler (for TOC)
  const goToChapter = useCallback(
    async (spineIndex: number) => {
      const position = chapters.findIndex((ch) => ch.spineIndex === spineIndex);
      if (position < 0) return;

      // If chapter is already loaded and visible, scroll to it
      if (visibleChapterIndices.includes(position)) {
        const el = chapterRefs.current.get(position);
        el?.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      // Otherwise, reset to just this chapter
      setIsLoadingMore(true);
      const chapter = await fetchChapter(position);
      if (chapter) {
        setVisibleChapterIndices([position]);
        setCurrentChapterIndex(position);
        onChapterChange?.(spineIndex);
        // Scroll to top
        scrollContainerRef.current?.scrollTo({ top: 0 });
      }
      setIsLoadingMore(false);
    },
    [chapters, visibleChapterIndices, fetchChapter, onChapterChange],
  );

  // Create highlight handler
  const handleCreateHighlight = useCallback(
    async (
      spineIndex: number,
      data: {
        startOffset: number;
        endOffset: number;
        selectedText: string;
        color: HighlightColor;
      },
    ) => {
      const res = await fetch('/api/reader/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          documentType,
          anchor: {
            chapterIndex: spineIndex,
            startOffset: data.startOffset,
            endOffset: data.endOffset,
          },
          selectedText: data.selectedText,
          color: data.color,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create highlight');
      }

      // Refresh highlights for this chapter
      fetchHighlights(spineIndex);
    },
    [documentId, fetchHighlights],
  );

  // Handle Ask AI action from selection
  const handleAskAI = useCallback(
    (
      spineIndex: number,
      data: { selectedText: string; startOffset: number; endOffset: number },
    ) => {
      setChatContext(data.selectedText);
      setChatContextAnchor({
        chapterIndex: spineIndex,
        startOffset: data.startOffset,
        endOffset: data.endOffset,
      });
      setActiveTab('chat');
      setPanelOpen(true);
    },
    [],
  );

  // Handle Add to Notes action from selection
  const handleAddToNotes = useCallback(
    async (
      spineIndex: number,
      data: { selectedText: string; startOffset: number; endOffset: number },
    ) => {
      const normalizeNoteSelection = (text: string) =>
        text
          .replace(/\[\s*\n\s*(\d+)\s*\]/g, '[$1]')
          .replace(/\[\s*\n\s*(\d+)\s*\n\s*\]/g, '[$1]')
          .replace(/\s+\n\s+/g, '\n')
          .trim();

      // Add quote to notes (preserve multi-line selection as blockquote)
      const normalized = normalizeNoteSelection(data.selectedText);
      const quotedText = `${normalized
        .split(/\r?\n/)
        .map((line) => `> ${line}`)
        .join('\n')}\n\n`;
      setNotes((prev) => (prev ? `${prev}${quotedText}` : quotedText));
      setActiveTab('notes');
      setPanelOpen(true);

      // Create note-quote annotation to link the passage to notes
      try {
        const res = await fetch('/api/reader/annotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId,
            documentType,
            anchor: {
              chapterIndex: spineIndex,
              startOffset: data.startOffset,
              endOffset: data.endOffset,
            },
            selectedText: data.selectedText,
            type: 'note-quote',
            content: {},
          }),
        });

        if (res.ok) {
          // Refresh annotations for this chapter to show the marker
          fetchAnnotations(spineIndex);
        }
      } catch (err) {
        console.error('Failed to create note-quote annotation:', err);
      }
    },
    [documentId, fetchAnnotations],
  );

  // Handle Add Comment action from selection
  const handleAddComment = useCallback(
    async (
      spineIndex: number,
      data: {
        selectedText: string;
        startOffset: number;
        endOffset: number;
        text: string;
      },
    ) => {
      try {
        const res = await fetch('/api/reader/annotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId,
            documentType,
            anchor: {
              chapterIndex: spineIndex,
              startOffset: data.startOffset,
              endOffset: data.endOffset,
            },
            selectedText: data.selectedText,
            type: 'comment',
            content: { text: data.text },
          }),
        });

        if (res.ok) {
          fetchAnnotations(spineIndex);
        }
      } catch (err) {
        console.error('Failed to create comment annotation:', err);
      }
    },
    [documentId, fetchAnnotations],
  );

  // Handle Edit Comment
  const handleEditComment = useCallback(
    async (annotationId: string, newText: string) => {
      const res = await fetch(`/api/reader/annotations/${annotationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { text: newText } }),
      });

      if (res.ok) {
        // Refresh annotations for all loaded chapters
        for (const position of visibleChapterIndices) {
          fetchAnnotations(getSpineIndexForPosition(position));
        }
        // Update the active comment with new text
        setActiveComment((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            annotation: {
              ...prev.annotation,
              content: { text: newText },
            },
          };
        });
      } else {
        throw new Error('Failed to update comment');
      }
    },
    [fetchAnnotations, visibleChapterIndices, getSpineIndexForPosition],
  );

  // Handle Delete Comment
  const handleDeleteComment = useCallback(
    async (annotationId: string) => {
      const res = await fetch(`/api/reader/annotations/${annotationId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Refresh annotations for all loaded chapters
        for (const position of visibleChapterIndices) {
          fetchAnnotations(getSpineIndexForPosition(position));
        }
      } else {
        throw new Error('Failed to delete comment');
      }
    },
    [fetchAnnotations, visibleChapterIndices, getSpineIndexForPosition],
  );

  // Handle annotation click - seed the chat with the Q&A, scroll to note quote, or show comment
  const handleAnnotationClick = useCallback(
    (annotation: AnnotationRow, position: { x: number; y: number }) => {
      if (annotation.type === 'comment') {
        // For comments, show the comment popover
        setActiveComment({ annotation, position });
      } else if (annotation.type === 'note-quote') {
        // For note-quote, open notes panel and scroll to the quote
        setScrollToQuoteText(annotation.selectedText);
        setActiveTab('notes');
        setPanelOpen(true);
      } else {
        // For QA annotations, seed the chat
        const content = annotation.content as {
          question?: string;
          answer?: string;
        };
        if (content.question && content.answer) {
          setSeedMessages({
            question: content.question,
            answer: content.answer,
          });
          setActiveTab('chat');
          setPanelOpen(true);
        }
      }
    },
    [],
  );

  // Handle quote click in notes - navigate to document location
  const handleQuoteClick = useCallback(
    async (quoteText: string) => {
      // Find the note-quote annotation that matches this quote text
      let matchingAnnotation: AnnotationRow | null = null;

      for (const [, annotations] of annotationsByChapter) {
        const found = annotations.find(
          (a) =>
            a.type === 'note-quote' &&
            a.selectedText.trim() === quoteText.trim(),
        );
        if (found) {
          matchingAnnotation = found;
          break;
        }
      }

      if (!matchingAnnotation) {
        console.warn(
          'No matching note-quote annotation found for quote:',
          quoteText,
        );
        return;
      }

      const anchor = matchingAnnotation.anchor as EpubHighlightAnchor;

      // Navigate to the chapter
      await goToChapter(anchor.chapterIndex);

      // Wait for chapter to render, then scroll to the text and highlight it
      setTimeout(() => {
        const position = chapters.findIndex(
          (ch) => ch.spineIndex === anchor.chapterIndex,
        );
        if (position < 0) return;
        const chapterEl = chapterRefs.current.get(position);
        if (!chapterEl) return;

        // Find the annotation span in the DOM
        const annotationSpan = chapterEl.querySelector(
          `[data-annotation-id="${matchingAnnotation.id}"]`,
        );
        if (annotationSpan) {
          // Scroll to the annotation
          annotationSpan.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });

          // Add flash highlight effect
          annotationSpan.classList.add('annotation-flash');
          setTimeout(() => {
            annotationSpan.classList.remove('annotation-flash');
          }, 2000);
        }
      }, 300);
    },
    [annotationsByChapter, goToChapter, chapters],
  );

  // Scroll tracking for progress (debounced)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !onProgressChange) return;

    const handleScroll = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight - container.clientHeight;
        const scrollPosition = scrollHeight > 0 ? scrollTop / scrollHeight : 0;

        onProgressChange(
          getSpineIndexForPosition(currentChapterIndex),
          scrollPosition,
        );
      }, 1000);
    };

    container.addEventListener('scroll', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [currentChapterIndex, onProgressChange, getSpineIndexForPosition]);

  // Restore scroll position after initial chapter loads
  useEffect(() => {
    if (
      shouldRestoreScroll.current &&
      !hasRestoredScroll.current &&
      !isLoadingMore &&
      visibleChapterIndices.length > 0 &&
      scrollContainerRef.current
    ) {
      const timeout = setTimeout(() => {
        const container = scrollContainerRef.current;
        if (container) {
          const scrollHeight = container.scrollHeight - container.clientHeight;
          container.scrollTop = scrollHeight * initialScrollPosition;
          hasRestoredScroll.current = true;
        }
      }, 100);

      return () => clearTimeout(timeout);
    }
  }, [isLoadingMore, visibleChapterIndices.length, initialScrollPosition]);

  // Get current chapter for header display
  const currentChapter = loadedChapters.get(currentChapterIndex);

  // Loading state
  if (isLoadingDoc) {
    return (
      <div className="flex h-dvh w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <LineSpinner className="text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Preparing your read...
            </p>
            {fromUpload && (
              <p className="text-xs text-muted-foreground">
                This can take a few seconds for larger files.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !epubDoc) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={onClose}>
          Go Back
        </Button>
      </div>
    );
  }

  if (!epubDoc) return null;

  return (
    <div className="relative flex h-full">
      {/* Main reader area */}
      <motion.div
        className="flex flex-1 flex-col overflow-hidden bg-background"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div
          className={cn(
            'relative flex items-center justify-between border-b bg-background/80 px-4 h-14 backdrop-blur-sm',
            !open && 'pl-16'
          )}
        >
          {!open && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2">
              <SidebarToggle className="md:px-2 md:h-fit" />
            </div>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-foreground truncate">
              {epubDoc.title}
            </span>
            {currentChapter && (
              <span className="text-xs text-muted-foreground truncate">
                • {currentChapter.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* TOC Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="size-8 p-0">
                  <List className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 max-h-96 overflow-y-auto"
              >
                {outline.length > 0
                  ? outline.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => goToChapter(item.pageIndex)}
                        className={
                          getSpineIndexForPosition(currentChapterIndex) ===
                          item.pageIndex
                            ? 'bg-accent'
                            : ''
                        }
                      >
                        <span className="truncate">{item.title}</span>
                      </DropdownMenuItem>
                    ))
                  : chapters.map((ch, index) => (
                      <DropdownMenuItem
                        key={ch.id}
                        onClick={() => goToChapter(ch.spineIndex)}
                        className={
                          currentChapterIndex === index ? 'bg-accent' : ''
                        }
                      >
                        <span className="truncate">{ch.title}</span>
                      </DropdownMenuItem>
                    ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="size-8 p-0"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Chapter Content - Infinite Scroll */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto scrollbar-none"
        >
          <div className="w-full max-w-3xl mx-auto p-6">
            {visibleChapterIndices.map((index) => {
              const chapter = loadedChapters.get(index);
              if (!chapter) return null;

              const highlights =
                highlightsByChapter.get(chapter.spineIndex) || [];
              const annotations =
                annotationsByChapter.get(chapter.spineIndex) || [];

              return (
                <div
                  key={chapter.id}
                  ref={(el) => {
                    if (el) chapterRefs.current.set(index, el);
                    else chapterRefs.current.delete(index);
                  }}
                >
                  <EpubChapter
                    title={chapter.title}
                    html={chapter.html}
                    highlights={highlights}
                    annotations={annotations}
                    onCreateHighlight={(data) =>
                      handleCreateHighlight(chapter.spineIndex, data)
                    }
                    onAskAI={(data) => handleAskAI(chapter.spineIndex, data)}
                    onAddToNotes={(data) =>
                      handleAddToNotes(chapter.spineIndex, data)
                    }
                    onAddComment={(data) =>
                      handleAddComment(chapter.spineIndex, data)
                    }
                    onAnnotationClick={handleAnnotationClick}
                  />
                  {/* Chapter separator */}
                  {index < chapters.length - 1 && (
                    <div className="my-12 border-t border-border" />
                  )}
                </div>
              );
            })}

            {/* Load more trigger */}
            <div ref={loadMoreTriggerRef} className="h-px" />

            {/* End of book indicator */}
            {visibleChapterIndices.length > 0 &&
              visibleChapterIndices[visibleChapterIndices.length - 1] ===
                chapters.length - 1 &&
              !isLoadingMore && (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  End of book
                </div>
              )}
          </div>
        </div>
      </motion.div>

      {/* Side Panel */}
      {isMobile ? (
        <MobilePanel
          open={panelOpen}
          onOpenChange={handlePanelOpenChange}
          context={chatContext}
          contextAnchor={chatContextAnchor}
          onClearContext={() => {
            setChatContext('');
            setChatContextAnchor(null);
          }}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          notes={notes}
          onNotesChange={setNotes}
          documentId={documentId}
          documentType={documentType}
          documentTitle={epubDoc?.title}
          onAnnotationCreated={fetchAnnotations}
          seedMessages={seedMessages}
          onSeedMessagesConsumed={() => setSeedMessages(null)}
          scrollToQuoteText={scrollToQuoteText}
          onScrollToQuoteComplete={() => setScrollToQuoteText(null)}
          onQuoteClick={handleQuoteClick}
        />
      ) : (
        <SidePanel
          open={panelOpen}
          onOpenChange={handlePanelOpenChange}
          context={chatContext}
          contextAnchor={chatContextAnchor}
          onClearContext={() => {
            setChatContext('');
            setChatContextAnchor(null);
          }}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          notes={notes}
          onNotesChange={setNotes}
          documentId={documentId}
          documentType={documentType}
          documentTitle={epubDoc?.title}
          onAnnotationCreated={fetchAnnotations}
          seedMessages={seedMessages}
          onSeedMessagesConsumed={() => setSeedMessages(null)}
          scrollToQuoteText={scrollToQuoteText}
          onScrollToQuoteComplete={() => setScrollToQuoteText(null)}
          onQuoteClick={handleQuoteClick}
        />
      )}

      {/* Comment Popover */}
      {activeComment && (
        <CommentPopover
          annotation={activeComment.annotation}
          position={activeComment.position}
          onClose={() => setActiveComment(null)}
          onEdit={handleEditComment}
          onDelete={handleDeleteComment}
        />
      )}
    </div>
  );
}
