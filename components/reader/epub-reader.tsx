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
import type { Annotation } from '@/lib/db/schema';
import type { TipTapDocument } from '@/lib/tiptap/html-to-json';

interface ChapterMeta {
  id: string;
  spineIndex: number;
  href: string;
  title: string;
}

interface ChapterContent extends ChapterMeta {
  content: unknown; // TipTap JSON
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

  // Annotations state (per section index)
  const [annotationsBySection, setAnnotationsBySection] = useState<
    Map<number, Annotation[]>
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
  const [chatContextSectionIndex, setChatContextSectionIndex] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [seedMessages, setSeedMessages] = useState<Array<{
    question: string;
    answer: string;
  }> | null>(null);
  const [scrollToQuoteText, setScrollToQuoteText] = useState<string | null>(
    null,
  );
  const [activeComment, setActiveComment] = useState<{
    annotation: Annotation;
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
        console.log('[EpubReader] Initial fetch response:', data);
        console.log('[EpubReader] Chapters:', data.chapters);
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

  // Fetch annotations for a section
  const fetchAnnotations = useCallback(
    async (sectionIndex: number) => {
      try {
        const res = await fetch(
          `/api/annotations?documentId=${documentId}&sectionIndex=${sectionIndex}`,
        );
        if (res.ok) {
          const data = await res.json();
          setAnnotationsBySection((prev) => {
            const next = new Map(prev);
            next.set(sectionIndex, data.annotations || []);
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
        console.log('[EpubReader] API response:', data);
        // Handle new format (section with content) or legacy format (chapter with html)
        const rawChapter = data.section || data.chapter;
        console.log('[EpubReader] rawChapter:', rawChapter);
        const chapter: ChapterContent = {
          id: rawChapter.id,
          spineIndex: rawChapter.index ?? rawChapter.spineIndex,
          href: rawChapter.href || '',
          title: rawChapter.title,
          content: rawChapter.content,
          text: rawChapter.textContent || rawChapter.text,
        };

        // Cache the chapter
        setLoadedChapters((prev) => {
          const next = new Map(prev);
          next.set(position, chapter);
          return next;
        });

        // Fetch annotations for this section
        fetchAnnotations(position);

        return chapter;
      } catch (err) {
        console.error('Failed to load chapter:', err);
        return null;
      }
    },
    [documentId, loadedChapters, fetchAnnotations, chapters],
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
                setVisibleChapterIndices((prev) =>
                  prev.includes(nextIndex) ? prev : [...prev, nextIndex]
                );
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

  // Handle Ask AI action from selection
  const handleAskAI = useCallback(
    (data: { selectedText: string; sectionIndex: number }) => {
      setChatContext(data.selectedText);
      setChatContextSectionIndex(data.sectionIndex);
      setActiveTab('chat');
      setPanelOpen(true);
    },
    [],
  );

  // Handle Add to Notes action from selection (new system)
  const handleAddToNotes = useCallback(
    async (data: { selectedText: string; sectionIndex: number; annotationId: string }) => {
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

      // The annotation is already created by EpubChapter, just log it
      console.log('[EpubReader] Quote added with annotation:', data.annotationId);
    },
    [],
  );

  // Handle Edit Comment
  const handleEditComment = useCallback(
    async (annotationId: string, newText: string) => {
      const res = await fetch(`/api/annotations/${annotationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { comment: newText } }),
      });

      if (res.ok) {
        // Refresh annotations for all loaded sections
        for (const index of visibleChapterIndices) {
          fetchAnnotations(index);
        }
        // Update the active comment with new text
        setActiveComment((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            annotation: {
              ...prev.annotation,
              content: { comment: newText },
            },
          };
        });
      } else {
        throw new Error('Failed to update comment');
      }
    },
    [fetchAnnotations, visibleChapterIndices],
  );

  // Handle Delete Comment
  const handleDeleteComment = useCallback(
    async (annotationId: string) => {
      const res = await fetch(`/api/annotations/${annotationId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Refresh annotations for all loaded sections
        for (const index of visibleChapterIndices) {
          fetchAnnotations(index);
        }
        // Close the popover
        setActiveComment(null);
      } else {
        throw new Error('Failed to delete comment');
      }
    },
    [fetchAnnotations, visibleChapterIndices],
  );

  // Handle annotation click - seed the chat with the Q&A, scroll to note quote, or show comment
  const handleAnnotationClick = useCallback(
    (annotation: Annotation, position?: { x: number; y: number }) => {
      if (annotation.type === 'comment' && position) {
        // For comments, show the comment popover
        setActiveComment({ annotation, position });
      } else if (annotation.type === 'quote') {
        // For quotes, open notes panel and scroll to the quote
        setScrollToQuoteText(annotation.selectedText);
        setActiveTab('notes');
        setPanelOpen(true);
      } else if (annotation.type === 'ai-response') {
        // For AI response annotations, seed the chat with single Q&A
        const content = annotation.content as {
          question?: string;
          answer?: string;
        } | null;
        if (content?.question && content?.answer) {
          setSeedMessages([{
            question: content.question,
            answer: content.answer,
          }]);
          setActiveTab('chat');
          setPanelOpen(true);
        }
      }
    },
    [],
  );

  // Handle multiple annotation click (for grouped ai-response annotations)
  const handleMultiAnnotationClick = useCallback(
    (annotationsToShow: Annotation[], position?: { x: number; y: number }) => {
      // Sort by creation date (oldest first) for chronological order
      const sorted = [...annotationsToShow]
        .filter(a => a.type === 'ai-response')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Extract Q&A content
      const qaPairs = sorted
        .map(a => {
          const content = a.content as { question?: string; answer?: string } | null;
          return content?.question && content?.answer
            ? { question: content.question, answer: content.answer }
            : null;
        })
        .filter((qa): qa is { question: string; answer: string } => qa !== null);

      if (qaPairs.length > 0) {
        setSeedMessages(qaPairs);
        setActiveTab('chat');
        setPanelOpen(true);
      }
    },
    [],
  );

  // Handle quote click in notes - navigate to document location
  const handleQuoteClick = useCallback(
    async (quoteText: string) => {
      // Find the quote annotation that matches this quote text
      let matchingAnnotation: Annotation | null = null;

      for (const [, annotations] of annotationsBySection) {
        const found = annotations.find(
          (a) =>
            a.type === 'quote' &&
            a.selectedText.trim() === quoteText.trim(),
        );
        if (found) {
          matchingAnnotation = found;
          break;
        }
      }

      if (!matchingAnnotation) {
        console.warn(
          'No matching quote annotation found for quote:',
          quoteText,
        );
        return;
      }

      const sectionIndex = matchingAnnotation.sectionIndex;
      const chapterMeta = chapters[sectionIndex];
      if (!chapterMeta) return;

      // Navigate to the chapter
      await goToChapter(chapterMeta.spineIndex);

      // Wait for chapter to render, then scroll to the text and highlight it
      setTimeout(() => {
        const chapterEl = chapterRefs.current.get(sectionIndex);
        if (!chapterEl) return;

        // Find the annotation span in the DOM
        const annotationSpan = chapterEl.querySelector(
          `[data-annotation-id="${matchingAnnotation!.id}"]`,
        );
        if (annotationSpan) {
          // Scroll to the annotation
          annotationSpan.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });

          // Add flash highlight effect (blue for quotes)
          annotationSpan.classList.add('quote-flash');
          setTimeout(() => {
            annotationSpan.classList.remove('quote-flash');
          }, 2000);
        }
      }, 300);
    },
    [annotationsBySection, goToChapter, chapters],
  );

  // Handle section content change (persist annotation marks)
  const handleContentChange = useCallback(
    async (sectionIndex: number, content: TipTapDocument) => {
      try {
        await fetch(`/api/documents/${documentId}/sections/${sectionIndex}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
      } catch (err) {
        console.error('Failed to save section content:', err);
      }
    },
    [documentId],
  );

  // Handle annotation created - refresh annotations for the section
  const handleAnnotationCreated = useCallback(
    (annotation: Annotation) => {
      // Update local state with the new annotation
      setAnnotationsBySection((prev) => {
        const next = new Map(prev);
        const existing = next.get(annotation.sectionIndex) || [];
        next.set(annotation.sectionIndex, [annotation, ...existing]);
        return next;
      });
    },
    [],
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
            'relative flex items-center justify-end border-b bg-background/80 px-4 h-12 backdrop-blur-sm',
            !open && 'pl-16'
          )}
        >
          {!open && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2">
              <SidebarToggle className="md:px-2 md:h-fit" />
            </div>
          )}

          <div className="flex items-center gap-1">
            {/* Chat/Notes toggle - only show when panel is open */}
            {panelOpen && !isMobile && (
              <div className="flex items-center p-0.5 rounded-md bg-muted/50 mr-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("chat")}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded transition-colors",
                    activeTab === "chat"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("notes")}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded transition-colors",
                    activeTab === "notes"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Notes
                </button>
              </div>
            )}

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
          </div>
        </div>

        {/* Chapter Content - Infinite Scroll */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto scrollbar-none"
        >
          <div className="w-full max-w-3xl mx-auto p-6">
            {/* Document title and chapter */}
            <div className="mb-8">
              <h1 className="text-lg font-medium text-foreground">
                {epubDoc.title}
              </h1>
              {currentChapter && (
                <p className="text-sm text-muted-foreground mt-1">
                  {currentChapter.title}
                </p>
              )}
            </div>
            {visibleChapterIndices.map((index) => {
              const chapter = loadedChapters.get(index);
              if (!chapter) return null;

              const annotations = annotationsBySection.get(index) || [];

              return (
                <div
                  key={`section-${index}`}
                  ref={(el) => {
                    if (el) chapterRefs.current.set(index, el);
                    else chapterRefs.current.delete(index);
                  }}
                >
                  <EpubChapter
                    title={chapter.title}
                    content={chapter.content as TipTapDocument}
                    sectionIndex={index}
                    documentId={documentId}
                    annotations={annotations}
                    onAnnotationCreated={handleAnnotationCreated}
                    onAnnotationClick={handleAnnotationClick}
                    onMultiAnnotationClick={handleMultiAnnotationClick}
                    onAskAI={handleAskAI}
                    onAddToNotes={handleAddToNotes}
                    onContentChange={(content) => handleContentChange(index, content)}
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
          contextAnchor={chatContextSectionIndex !== null ? {
            chapterIndex: chatContextSectionIndex,
            startOffset: 0,
            endOffset: 0,
          } : null}
          onClearContext={() => {
            setChatContext('');
            setChatContextSectionIndex(null);
          }}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          notes={notes}
          onNotesChange={setNotes}
          documentId={documentId}
          documentType={documentType}
          documentTitle={epubDoc?.title}
          onAnnotationCreated={(sectionIndex: number) => fetchAnnotations(sectionIndex)}
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
          contextAnchor={chatContextSectionIndex !== null ? {
            chapterIndex: chatContextSectionIndex,
            startOffset: 0,
            endOffset: 0,
          } : null}
          onClearContext={() => {
            setChatContext('');
            setChatContextSectionIndex(null);
          }}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          notes={notes}
          onNotesChange={setNotes}
          documentId={documentId}
          documentType={documentType}
          documentTitle={epubDoc?.title}
          onAnnotationCreated={(sectionIndex: number) => fetchAnnotations(sectionIndex)}
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
