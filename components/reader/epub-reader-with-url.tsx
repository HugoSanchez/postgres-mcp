'use client';

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { EpubReader } from './epub-reader';

interface EpubReaderWithUrlProps {
  documentId: string;
  initialChapter: number;
  initialScrollPosition: number;
  fromUpload?: boolean;
  documentType?: 'epub' | 'article' | 'pdf';
}

/**
 * Wrapper around EpubReader that syncs chapter navigation with the URL
 * and saves reading progress.
 * Used by the /read/[documentId] route.
 */
export function EpubReaderWithUrl({
  documentId,
  initialChapter,
  initialScrollPosition,
  fromUpload = false,
  documentType = 'epub',
}: EpubReaderWithUrlProps) {
  const router = useRouter();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleChapterChange = useCallback(
    (chapterIndex: number) => {
      // Update URL without full navigation (shallow)
      const url = chapterIndex === 0
        ? `/read/${documentId}`
        : `/read/${documentId}?chapter=${chapterIndex}`;
      router.replace(url, { scroll: false });
    },
    [documentId, router]
  );

  const handleProgressChange = useCallback(
    (chapterIndex: number, scrollPosition: number) => {
      // Debounce API calls
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch('/api/reader/progress', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId,
              documentType,
              chapterIndex,
              scrollPosition,
            }),
          });
          if (res.ok) {
            window.dispatchEvent(new Event('reading-progress-updated'));
          }
        } catch (error) {
          console.error('Failed to save reading progress:', error);
        }
      }, 500);
    },
    [documentId, documentType]
  );

  const handleClose = useCallback(() => {
    router.push('/');
  }, [router]);

  return (
    <EpubReader
      documentId={documentId}
      initialChapter={initialChapter}
      initialScrollPosition={initialScrollPosition}
      fromUpload={fromUpload}
      documentType={documentType}
      onClose={handleClose}
      onChapterChange={handleChapterChange}
      onProgressChange={handleProgressChange}
    />
  );
}
