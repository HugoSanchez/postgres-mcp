'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';

interface ReadingItem {
  documentId: string;
  documentType: string;
  title: string;
  chapterIndex: number | null;
  scrollPosition: number;
  lastReadAt: string;
}

export function SidebarReadingProgress() {
  const [items, setItems] = useState<ReadingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setOpenMobile } = useSidebar();

  useEffect(() => {
    async function fetchRecentReading() {
      try {
        const res = await fetch('/api/reading-progress/recent?limit=3');
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch (error) {
        console.error('Failed to fetch reading progress:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecentReading();
  }, []);

  if (isLoading || items.length === 0) {
    return null;
  }

  return (
    <div className="p-2">
      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
        Continue Reading
      </div>
      <div className="flex flex-col gap-1 mt-1">
        {items.map((item) => {
          const href =
            item.chapterIndex !== null && item.chapterIndex > 0
              ? `/read/${item.documentId}?chapter=${item.chapterIndex}`
              : `/read/${item.documentId}`;

          return (
            <Link
              key={item.documentId}
              href={href}
              onClick={() => setOpenMobile(false)}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
            >
              <BookOpen className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">
                  {item.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  Continue reading
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
