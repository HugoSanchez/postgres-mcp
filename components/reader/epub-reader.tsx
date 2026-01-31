'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import {
  BookOpen,
  List,
  Loader2,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { EpubChapter } from './epub-chapter';
import { SidePanel } from './side-panel';
import { MobilePanel } from './mobile-panel';
import { useIsMobile } from '@/hooks/use-mobile';
import type { HighlightRow, HighlightColor, EpubHighlightAnchor, AnnotationRow } from '@/lib/db/types';

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
  onClose: () => void;
  onChapterChange?: (chapterIndex: number) => void;
  onProgressChange?: (chapterIndex: number, scrollPosition: number) => void;
}

export function EpubReader({
  documentId,
  initialChapter = 0,
  initialScrollPosition = 0,
  onClose,
  onChapterChange,
  onProgressChange,
}: EpubReaderProps) {
  // Document metadata
  const [document, setDocument] = useState<EpubDocument | null>(null);
  const [chapters, setChapters] = useState<ChapterMeta[]>([]);
  const [outline, setOutline] = useState<OutlineItem[]>([]);

  // Loaded chapters (for infinite scroll)
  const [loadedChapters, setLoadedChapters] = useState<Map<number, ChapterContent>>(new Map());
  const [visibleChapterIndices, setVisibleChapterIndices] = useState<number[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(initialChapter);

  // Loading states
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Highlights state (per chapter)
  const [highlightsByChapter, setHighlightsByChapter] = useState<Map<number, HighlightRow[]>>(new Map());

  // Annotations state (per chapter)
  const [annotationsByChapter, setAnnotationsByChapter] = useState<Map<number, AnnotationRow[]>>(new Map());

  // Scroll tracking
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const shouldRestoreScroll = useRef(initialChapter === 0 && initialScrollPosition > 0);
  const hasRestoredScroll = useRef(false);

  // Side panel state
  const isMobile = useIsMobile();
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('chat');
  const [chatContext, setChatContext] = useState('');
  const [chatContextAnchor, setChatContextAnchor] = useState<EpubHighlightAnchor | null>(null);
  const [notes, setNotes] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [seedMessages, setSeedMessages] = useState<{ question: string; answer: string } | null>(null);
  const [scrollToQuoteText, setScrollToQuoteText] = useState<string | null>(null);
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
        setDocument(data.document);
        setChapters(data.chapters);
        setOutline(data.outline);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document');
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
          `/api/reader/notes?documentId=${documentId}&documentType=epub`
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
      { type: 'application/json' }
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
  const handlePanelOpenChange = useCallback((open: boolean) => {
    if (!open) {
      // Panel is closing - save immediately
      saveNotesImmediately();
    }
    setPanelOpen(open);
  }, [saveNotesImmediately]);

  // Fetch highlights for a chapter
  const fetchHighlights = useCallback(
    async (chapterIndex: number) => {
      try {
        const res = await fetch(
          `/api/reader/highlights?documentId=${documentId}&chapterIndex=${chapterIndex}`
        );
        if (res.ok) {
          const data = await res.json();
          setHighlightsByChapter(prev => {
            const next = new Map(prev);
            next.set(chapterIndex, data.highlights || []);
            return next;
          });
        }
      } catch (err) {
        console.error('Failed to fetch highlights:', err);
      }
    },
    [documentId]
  );

  // Fetch annotations for a chapter
  const fetchAnnotations = useCallback(
    async (chapterIndex: number) => {
      try {
        const res = await fetch(
          `/api/reader/annotations?documentId=${documentId}&chapterIndex=${chapterIndex}`
        );
        if (res.ok) {
          const data = await res.json();
          setAnnotationsByChapter(prev => {
            const next = new Map(prev);
            next.set(chapterIndex, data.annotations || []);
            return next;
          });
        }
      } catch (err) {
        console.error('Failed to fetch annotations:', err);
      }
    },
    [documentId]
  );

  // Fetch chapter content
  const fetchChapter = useCallback(
    async (index: number): Promise<ChapterContent | null> => {
      // Return cached chapter if available
      const cached = loadedChapters.get(index);
      if (cached) return cached;

      try {
        const res = await fetch(`/api/reader/epub/${documentId}?chapter=${index}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load chapter');
        }

        const data = await res.json();
        const chapter = data.chapter as ChapterContent;

        // Cache the chapter
        setLoadedChapters(prev => {
          const next = new Map(prev);
          next.set(index, chapter);
          return next;
        });

        // Fetch highlights and annotations for this chapter
        fetchHighlights(index);
        fetchAnnotations(index);

        return chapter;
      } catch (err) {
        console.error('Failed to load chapter:', err);
        return null;
      }
    },
    [documentId, loadedChapters, fetchHighlights, fetchAnnotations]
  );

  // Load initial chapter when document is loaded
  useEffect(() => {
    if (chapters.length > 0 && visibleChapterIndices.length === 0) {
      const startChapter = Math.min(initialChapter, chapters.length - 1);
      setIsLoadingMore(true);
      fetchChapter(startChapter).then(() => {
        setVisibleChapterIndices([startChapter]);
        setCurrentChapterIndex(startChapter);
        onChapterChange?.(startChapter);
        setIsLoadingMore(false);
      });
    }
  }, [chapters, visibleChapterIndices.length, fetchChapter, initialChapter, onChapterChange]);

  // Load more chapters when scrolling near bottom (intersection observer)
  useEffect(() => {
    const trigger = loadMoreTriggerRef.current;
    if (!trigger) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !isLoadingMore && visibleChapterIndices.length > 0) {
          const lastVisibleIndex = visibleChapterIndices[visibleChapterIndices.length - 1];
          const nextIndex = lastVisibleIndex + 1;

          if (nextIndex < chapters.length) {
            setIsLoadingMore(true);
            fetchChapter(nextIndex).then((chapter) => {
              if (chapter) {
                setVisibleChapterIndices(prev => [...prev, nextIndex]);
              }
              setIsLoadingMore(false);
            });
          }
        }
      },
      { rootMargin: '200px' }
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
        onChapterChange?.(mostVisibleIndex);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [visibleChapterIndices, currentChapterIndex, onChapterChange]);

  // Navigation handler (for TOC)
  const goToChapter = useCallback(
    async (index: number) => {
      if (index < 0 || index >= chapters.length) return;

      // If chapter is already loaded and visible, scroll to it
      if (visibleChapterIndices.includes(index)) {
        const el = chapterRefs.current.get(index);
        el?.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      // Otherwise, reset to just this chapter
      setIsLoadingMore(true);
      const chapter = await fetchChapter(index);
      if (chapter) {
        setVisibleChapterIndices([index]);
        setCurrentChapterIndex(index);
        onChapterChange?.(index);
        // Scroll to top
        scrollContainerRef.current?.scrollTo({ top: 0 });
      }
      setIsLoadingMore(false);
    },
    [chapters.length, visibleChapterIndices, fetchChapter, onChapterChange]
  );

  // Create highlight handler
  const handleCreateHighlight = useCallback(
    async (chapterIndex: number, data: {
      startOffset: number;
      endOffset: number;
      selectedText: string;
      color: HighlightColor;
    }) => {
      const res = await fetch('/api/reader/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          documentType: 'epub',
          anchor: {
            chapterIndex,
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
      fetchHighlights(chapterIndex);
    },
    [documentId, fetchHighlights]
  );

  // Handle Ask AI action from selection
  const handleAskAI = useCallback((
    chapterIndex: number,
    data: { selectedText: string; startOffset: number; endOffset: number }
  ) => {
    setChatContext(data.selectedText);
    setChatContextAnchor({
      chapterIndex,
      startOffset: data.startOffset,
      endOffset: data.endOffset,
    });
    setActiveTab('chat');
    setPanelOpen(true);
  }, []);

  // Handle Add to Notes action from selection
  const handleAddToNotes = useCallback(async (
    chapterIndex: number,
    data: { selectedText: string; startOffset: number; endOffset: number }
  ) => {
    // Add quote to notes
    const quotedText = `> ${data.selectedText}\n\n`;
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
          documentType: 'epub',
          anchor: {
            chapterIndex,
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
        fetchAnnotations(chapterIndex);
      }
    } catch (err) {
      console.error('Failed to create note-quote annotation:', err);
    }
  }, [documentId, fetchAnnotations]);

  // Handle annotation click - seed the chat with the Q&A or scroll to note quote
  const handleAnnotationClick = useCallback((annotation: AnnotationRow) => {
    if (annotation.type === 'note-quote') {
      // For note-quote, open notes panel and scroll to the quote
      setScrollToQuoteText(annotation.selectedText);
      setActiveTab('notes');
      setPanelOpen(true);
    } else {
      // For QA annotations, seed the chat
      const content = annotation.content as { question?: string; answer?: string };
      if (content.question && content.answer) {
        setSeedMessages({ question: content.question, answer: content.answer });
        setActiveTab('chat');
        setPanelOpen(true);
      }
    }
  }, []);

  // Handle quote click in notes - navigate to document location
  const handleQuoteClick = useCallback(async (quoteText: string) => {
    // Find the note-quote annotation that matches this quote text
    let matchingAnnotation: AnnotationRow | null = null;

    for (const [, annotations] of annotationsByChapter) {
      const found = annotations.find(
        (a) => a.type === 'note-quote' && a.selectedText.trim() === quoteText.trim()
      );
      if (found) {
        matchingAnnotation = found;
        break;
      }
    }

    if (!matchingAnnotation) {
      console.warn('No matching note-quote annotation found for quote:', quoteText);
      return;
    }

    const anchor = matchingAnnotation.anchor as EpubHighlightAnchor;

    // Navigate to the chapter
    await goToChapter(anchor.chapterIndex);

    // Wait for chapter to render, then scroll to the text and highlight it
    setTimeout(() => {
      const chapterEl = chapterRefs.current.get(anchor.chapterIndex);
      if (!chapterEl) return;

      // Find the annotation span in the DOM
      const annotationSpan = chapterEl.querySelector(
        `[data-annotation-id="${matchingAnnotation.id}"]`
      );
      if (annotationSpan) {
        // Scroll to the annotation
        annotationSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Add flash highlight effect
        annotationSpan.classList.add('annotation-flash');
        setTimeout(() => {
          annotationSpan.classList.remove('annotation-flash');
        }, 2000);
      }
    }, 300);
  }, [annotationsByChapter, goToChapter]);

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

        onProgressChange(currentChapterIndex, scrollPosition);
      }, 1000);
    };

    container.addEventListener('scroll', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [currentChapterIndex, onProgressChange]);

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
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error && !document) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={onClose}>
          Go Back
        </Button>
      </div>
    );
  }

  if (!document) return null;

  return (
    <div className="flex h-full">
      {/* Main reader area */}
      <motion.div
        className="flex flex-1 flex-col overflow-hidden bg-background"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-background/80 px-4 h-14 backdrop-blur-sm">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="size-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">
              {document.title}
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
              <DropdownMenuContent align="end" className="w-64 max-h-96 overflow-y-auto">
                {outline.length > 0
                  ? outline.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => goToChapter(item.pageIndex)}
                        className={
                          currentChapterIndex === item.pageIndex
                            ? 'bg-accent'
                            : ''
                        }
                      >
                        <span className="truncate">{item.title}</span>
                      </DropdownMenuItem>
                    ))
                  : chapters.map((ch) => (
                      <DropdownMenuItem
                        key={ch.id}
                        onClick={() => goToChapter(ch.spineIndex)}
                        className={
                          currentChapterIndex === ch.spineIndex ? 'bg-accent' : ''
                        }
                      >
                        <span className="truncate">{ch.title}</span>
                      </DropdownMenuItem>
                    ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Close button */}
            <Button variant="ghost" size="sm" onClick={onClose} className="size-8 p-0">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Chapter Content - Infinite Scroll */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto scrollbar-none">
          <div className="w-full max-w-3xl mx-auto p-6">
            {visibleChapterIndices.map((index) => {
              const chapter = loadedChapters.get(index);
              if (!chapter) return null;

              const highlights = highlightsByChapter.get(index) || [];
              const annotations = annotationsByChapter.get(index) || [];

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
                    onCreateHighlight={(data) => handleCreateHighlight(index, data)}
                    onAskAI={(data) => handleAskAI(index, data)}
                    onAddToNotes={(data) => handleAddToNotes(index, data)}
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

            {/* Loading indicator */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* End of book indicator */}
            {visibleChapterIndices.length > 0 &&
              visibleChapterIndices[visibleChapterIndices.length - 1] === chapters.length - 1 &&
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
          documentTitle={document?.title}
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
          documentTitle={document?.title}
          onAnnotationCreated={fetchAnnotations}
          seedMessages={seedMessages}
          onSeedMessagesConsumed={() => setSeedMessages(null)}
          scrollToQuoteText={scrollToQuoteText}
          onScrollToQuoteComplete={() => setScrollToQuoteText(null)}
          onQuoteClick={handleQuoteClick}
        />
      )}
    </div>
  );
}
