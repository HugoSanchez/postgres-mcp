import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { auth } from '@/app/(auth)/auth';
import { getEpubWithChapters } from '@/lib/db/epub';
import { getReadingProgress } from '@/lib/db/reading-progress';
import { EpubReaderWithUrl } from '@/components/reader/epub-reader-with-url';

interface ReadPageProps {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ chapter?: string }>;
}

export default async function ReadPage({ params, searchParams }: ReadPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const { documentId } = await params;
  const { chapter } = await searchParams;

  // Verify document exists and belongs to user
  const epub = await getEpubWithChapters(documentId);
  if (!epub || epub.doc.userId !== session.user.id) {
    notFound();
  }

  // Get saved reading progress
  const savedProgress = await getReadingProgress(session.user.id, documentId);

  // If URL has chapter param, use it; otherwise use saved progress
  let initialChapter = 0;
  let initialScrollPosition = 0;

  if (chapter !== undefined) {
    // URL takes precedence
    initialChapter = Number.parseInt(chapter, 10);
  } else if (savedProgress) {
    // Use saved progress
    initialChapter = savedProgress.chapterIndex ?? 0;
    initialScrollPosition = savedProgress.scrollPosition ?? 0;
  }

  return (
    <div className="h-dvh w-full bg-background">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <EpubReaderWithUrl
          documentId={documentId}
          initialChapter={initialChapter}
          initialScrollPosition={initialScrollPosition}
        />
      </Suspense>
    </div>
  );
}
