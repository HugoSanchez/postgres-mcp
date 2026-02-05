'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { EpubUploader } from './epub-uploader';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { useSidebar } from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';

export function HomeScreen() {
  const { open } = useSidebar();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleUrlImport = async () => {
    if (!url.trim()) {
      setUrlError('Please enter a URL');
      return;
    }

    setUrlError(null);
    setIsImportingUrl(true);

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
        throw new Error(body.error || 'Failed to import article');
      }

      const data = (await res.json()) as { documentId: string; title?: string };
      toast.success(`Loaded "${data.title || 'Article'}"`);
      router.push(`/read/${data.documentId}?fromUpload=1`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to import article';
      setUrlError(message);
    } finally {
      setIsImportingUrl(false);
    }
  };

  return (
    <div className="relative flex h-dvh flex-col items-center justify-center bg-background p-6">
      {!open && (
        <div className="absolute left-4 top-4 z-10">
          <SidebarToggle className="md:px-2 md:h-fit" />
        </div>
      )}

      <div className="flex flex-col items-start gap-8 w-full max-w-2xl">
        {/* Welcome Message */}
        <motion.div
          className="flex flex-col items-start gap-3 text-left w-full"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Hey there!
          </h1>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground/50">
            What are we reading today?
          </h1>
        </motion.div>

        {/* EPUB Uploader */}
        <EpubUploader />

        {/* URL Import */}
        <div className="w-full max-w-2xl flex flex-col items-center gap-2">
          <span className="text-sm text-primary font-medium py-2 text-center">
            - or add a url -
          </span>
          <Input
            type="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !isImportingUrl) {
                event.preventDefault();
                handleUrlImport();
              }
            }}
            disabled={isImportingUrl}
          />
          {urlError && (
            <div className="w-full text-xs text-destructive text-left">{urlError}</div>
          )}
        </div>
      </div>
    </div>
  );
}
