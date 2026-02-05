'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Trash2 } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function fetchRecentReading() {
      try {
        const res = await fetch('/api/reader/progress/recent?limit=3');
        if (!isActive) return;
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch (error) {
        if (isActive) {
          console.error('Failed to fetch reading progress:', error);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchRecentReading();

    const handleUpdate = () => {
      fetchRecentReading();
    };
    window.addEventListener('reading-progress-updated', handleUpdate);
    return () => {
      isActive = false;
      window.removeEventListener('reading-progress-updated', handleUpdate);
    };
  }, []);

  const deleteRead = async (documentId: string) => {
    try {
      const res = await fetch(`/api/reader/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete');
      }

      setItems((prev) => prev.filter((item) => item.documentId !== documentId));
    } catch (error) {
      console.error('Failed to delete document', error);
    }
  };

  const openDeleteDialog = (documentId: string, title: string) => {
    setDeleteId(documentId);
    setDeleteTitle(title);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    await deleteRead(deleteId);
    setShowDeleteDialog(false);
    setDeleteId(null);
    setDeleteTitle(null);
  };

  if (isLoading || items.length === 0) {
    return null;
  }

  return (
    <div className="p-2">
      <div className="flex flex-col gap-1 mt-1">
        {items.map((item) => {
          const href =
            item.chapterIndex !== null && item.chapterIndex > 0
              ? `/read/${item.documentId}?chapter=${item.chapterIndex}`
              : `/read/${item.documentId}`;

          return (
            <div
              key={item.documentId}
              className="group/read flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
            >
              <BookOpen className="size-3.5 text-muted-foreground/80 mt-0.5 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={href}
                  onClick={() => setOpenMobile(false)}
                  className="text-sm font-medium truncate"
                >
                  {item.title}
                </Link>
                <span className="text-xs text-muted-foreground">
                  Continue reading
                </span>
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/read:opacity-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => openDeleteDialog(item.documentId, item.title)}
                  aria-label="Delete read"
                >
                  <Trash2 className="size-3.5 text-muted-foreground/70" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this read?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{' '}
              <span className="font-medium text-foreground">
                {deleteTitle || 'this item'}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
