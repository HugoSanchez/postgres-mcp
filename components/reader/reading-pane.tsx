'use client';

import { useRef, useState } from 'react';
import { BookOpen, Globe, Loader2, Upload, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { SidebarToggle } from '../sidebar-toggle';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useSidebar } from '../ui/sidebar';
import { EpubReader } from './epub-reader';

// Type for the article response from our API
type ArticleResponse = {
  title: string;
  content: string;
  byline: string | null;
  excerpt: string | null;
  url: string;
  length: number;
};

type ViewMode = 'input' | 'article' | 'epub';

export function ReadingPane() {
  const [url, setUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View mode: input (default), article, or epub
  const [viewMode, setViewMode] = useState<ViewMode>('input');

  // Article state: stores the fetched article info
  const [article, setArticle] = useState<ArticleResponse | null>(null);

  // EPUB state
  const [epubDocumentId, setEpubDocumentId] = useState<string | null>(null);
  const [isUploadingEpub, setIsUploadingEpub] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { open } = useSidebar();

  const handleFetch = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setError(null);
    setArticle(null);
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

      const data = (await res.json()) as ArticleResponse;
      setArticle(data);
      setViewMode('article');
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

      const res = await fetch('/api/upload/epub', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to upload EPUB');
      }

      const data = await res.json();
      setEpubDocumentId(data.documentId);
      setViewMode('epub');
      toast.success(`Loaded "${data.title || file.name}"`);
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

  // Clear state and return to input mode
  const clearContent = () => {
    setArticle(null);
    setEpubDocumentId(null);
    setUrl('');
    setError(null);
    setViewMode('input');
  };

  // Render EPUB reader
  if (viewMode === 'epub' && epubDocumentId) {
    return (
      <motion.div
        className="relative bg-accent flex flex-1 flex-col overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {!open && (
          <div className="absolute left-2 top-2 z-10">
            <SidebarToggle className="md:px-2 md:h-fit" />
          </div>
        )}
        <EpubReader documentId={epubDocumentId} onClose={clearContent} />
      </motion.div>
    );
  }

  // Render article reader when article is loaded
  if (viewMode === 'article' && article) {
    return (
      <motion.div
        className="relative bg-accent flex flex-1 flex-col overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {!open && (
          <div className="absolute left-2 top-2 z-10">
            <SidebarToggle className="md:px-2 md:h-fit" />
          </div>
        )}

        {/* Article Header */}
        <div className="flex items-center justify-between border-b bg-background/80 px-4 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="size-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">
              {article.title}
            </span>
            {article.byline && (
              <span className="text-xs text-muted-foreground truncate">
                • {article.byline}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearContent}
            className="size-8 p-0 shrink-0"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Article Content */}
        <div className="flex flex-1 overflow-auto">
          <div className="w-full max-w-3xl mx-auto p-6 prose prose-lg dark:prose-invert prose-headings:font-semibold prose-a:text-primary prose-img:rounded-lg prose-img:shadow-md [&_svg]:max-w-[10px] [&_svg]:max-h-[24px] [&_svg]:inline-block [&_svg]:align-middle [&_table]:overflow-x-auto [&_table]:block [&_table]:w-full">
            <div dangerouslySetInnerHTML={{ __html: article.content }} />
          </div>
        </div>
      </motion.div>
    );
  }

  // Render input UI when no content is loaded
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
                Paste a URL to read articles, blog posts, or newsletters
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
