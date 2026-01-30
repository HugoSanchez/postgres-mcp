'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Upload, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function EpubUploader() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      // Validate file type
      if (
        file.type !== 'application/epub+zip' &&
        !file.name.endsWith('.epub')
      ) {
        toast.error('Please select an EPUB file');
        return;
      }

      setIsUploading(true);

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
        router.push(`/read/${data.documentId}`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to upload EPUB';
        toast.error(message);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [router]
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      const file = event.dataTransfer.files?.[0];
      if (file) {
        handleUpload(file);
      }
    },
    [handleUpload]
  );

  return (
    <motion.div
      className={cn(
        'relative w-full max-w-md rounded-2xl border-2 border-dashed p-8 transition-colors',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-muted-foreground/50'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className={cn(
            'flex size-16 items-center justify-center rounded-full transition-colors',
            isDragging ? 'bg-primary/10' : 'bg-muted'
          )}
        >
          {isUploading ? (
            <Loader2 className="size-7 animate-spin text-primary" />
          ) : (
            <BookOpen
              className={cn(
                'size-7 transition-colors',
                isDragging ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          )}
        </div>

        <div className="space-y-2">
          <p className="text-base font-medium text-foreground">
            {isUploading ? 'Uploading...' : 'Drop your EPUB here'}
          </p>
          <p className="text-sm text-muted-foreground">
            or click to browse your files
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/epub+zip,.epub"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />

        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="mt-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="mr-2 size-4" />
              Select EPUB
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
