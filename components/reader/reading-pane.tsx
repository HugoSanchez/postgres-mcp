'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Globe, Loader2, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { SidebarToggle } from '../sidebar-toggle';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useSidebar } from '../ui/sidebar';

export function ReadingPane() {
  const router = useRouter();
  const [url, setUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // EPUB upload state
  const [isUploadingEpub, setIsUploadingEpub] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { open } = useSidebar();

  const handleFetch = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/reader/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to fetch article');
      }

      const data = (await res.json()) as { documentId: string; title?: string };
      toast.success(`Loaded "${data.title || 'Article'}"`);
      router.push(`/read/${data.documentId}?fromUpload=1`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch article';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isLoading) {
      event.preventDefault();
      handleFetch();
    }
  };

  // Handle EPUB file upload
  const handleEpubUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/epub+zip') {
      toast.error('Please select an EPUB file');
      return;
    }

    setIsUploadingEpub(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/documents/upload/epub', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to upload EPUB');
      }

      const data = await res.json();
      toast.success(`Loaded "${data.title || file.name}"`);
      // Navigate to the read route
      router.push(`/read/${data.documentId}?fromUpload=1`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to upload EPUB';
      toast.error(message);
      setError(message);
    } finally {
      setIsUploadingEpub(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <motion.div
      className="relative bg-accent flex flex-1 items-center justify-center p-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {!open && (
        <div className="absolute left-2 top-2 z-10">
          <SidebarToggle className="md:px-2 md:h-fit" />
        </div>
      )}
      <motion.div
        className="w-full max-w-xl rounded-2xl p-6"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
      >
        <div className="flex flex-col items-center justify-center gap-6">
          {/* URL Input Section */}
          <div className="w-full flex flex-col items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Globe className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium text-foreground">
                Enter an article URL
              </p>
              <p className="text-sm text-muted-foreground">
                Paste a URL to import an article into the reader
              </p>
            </div>

            <div className="w-full flex gap-2">
              <Input
                type="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || isUploadingEpub}
                className="flex-1"
              />
              <Button
                onClick={handleFetch}
                disabled={isLoading || isUploadingEpub || !url.trim()}
                className="shrink-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  'Fetch'
                )}
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="w-full flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* EPUB Upload Section */}
          <div className="w-full flex flex-col items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <BookOpen className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium text-foreground">
                Upload an EPUB
              </p>
              <p className="text-sm text-muted-foreground">
                Read ebooks with chapter navigation
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/epub+zip,.epub"
              onChange={handleEpubUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploadingEpub}
              className="w-full max-w-xs"
            >
              {isUploadingEpub ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 size-4" />
                  Select EPUB file
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="w-full mt-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
