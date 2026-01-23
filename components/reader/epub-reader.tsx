'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  Loader2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { EpubChapter } from './epub-chapter';

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
  onClose: () => void;
}

export function EpubReader({ documentId, onClose }: EpubReaderProps) {
  // Document metadata
  const [document, setDocument] = useState<EpubDocument | null>(null);
  const [chapters, setChapters] = useState<ChapterMeta[]>([]);
  const [outline, setOutline] = useState<OutlineItem[]>([]);

  // Current chapter state
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentChapter, setCurrentChapter] = useState<ChapterContent | null>(
    null
  );

  // Loading states
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);
  const [isLoadingChapter, setIsLoadingChapter] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch document metadata and chapter list
  useEffect(() => {
    async function fetchDocument() {
      setIsLoadingDoc(true);
      setError(null);

      try {
        const res = await fetch(`/api/epub/${documentId}`);
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

  // Fetch chapter content
  const fetchChapter = useCallback(
    async (index: number) => {
      setIsLoadingChapter(true);

      try {
        const res = await fetch(`/api/epub/${documentId}?chapter=${index}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load chapter');
        }

        const data = await res.json();
        setCurrentChapter(data.chapter);
        setCurrentChapterIndex(index);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load chapter');
      } finally {
        setIsLoadingChapter(false);
      }
    },
    [documentId]
  );

  // Load first chapter when document is loaded
  useEffect(() => {
    if (chapters.length > 0 && !currentChapter) {
      fetchChapter(0);
    }
  }, [chapters, currentChapter, fetchChapter]);

  // Navigation handlers
  const goToPrevChapter = () => {
    if (currentChapterIndex > 0) {
      fetchChapter(currentChapterIndex - 1);
    }
  };

  const goToNextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) {
      fetchChapter(currentChapterIndex + 1);
    }
  };

  const goToChapter = (index: number) => {
    if (index >= 0 && index < chapters.length) {
      fetchChapter(index);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentChapterIndex > 0) {
        fetchChapter(currentChapterIndex - 1);
      } else if (
        e.key === 'ArrowRight' &&
        currentChapterIndex < chapters.length - 1
      ) {
        fetchChapter(currentChapterIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentChapterIndex, chapters.length, fetchChapter]);

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
    <motion.div
      className="flex flex-1 flex-col overflow-hidden bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-background/80 px-4 py-2 backdrop-blur-sm">
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

      {/* Chapter Content */}
      <div className="flex flex-1 overflow-auto">
        <div className="w-full max-w-3xl mx-auto p-6">
          <AnimatePresence mode="wait">
            {isLoadingChapter ? (
              <motion.div
                key="loading"
                className="flex items-center justify-center py-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </motion.div>
            ) : currentChapter ? (
              <EpubChapter
                key={currentChapter.id}
                title={currentChapter.title}
                html={currentChapter.html}
              />
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between border-t bg-background/80 px-4 py-2 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={goToPrevChapter}
          disabled={currentChapterIndex === 0 || isLoadingChapter}
        >
          <ChevronLeft className="size-4 mr-1" />
          Previous
        </Button>

        <span className="text-sm text-muted-foreground">
          {currentChapterIndex + 1} / {chapters.length}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={goToNextChapter}
          disabled={
            currentChapterIndex === chapters.length - 1 || isLoadingChapter
          }
        >
          Next
          <ChevronRight className="size-4 ml-1" />
        </Button>
      </div>
    </motion.div>
  );
}
