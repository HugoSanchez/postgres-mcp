'use client';

import { useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { motion } from 'framer-motion';

import { SidebarToggle } from '../sidebar-toggle';
import { Button } from '../ui/button';
import { useSidebar } from '../ui/sidebar';

// Type for the upload response from our API
type UploadResponse = {
  documentId: string;
  blobUrl: string;
  numPages: number;
};

export function ReadingPane() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Document state: stores the uploaded document info
  const [document, setDocument] = useState<UploadResponse | null>(null);

  const { open } = useSidebar();

  const handleBrowse = () => {
    inputRef.current?.click();
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setIsDragActive(false);
    uploadPdf(file);
  };

  const handleDragOver: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave: React.DragEventHandler<HTMLDivElement> = () => {
    setIsDragActive(false);
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (
    event,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    uploadPdf(file);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleBrowse();
    }
  };

  const uploadPdf = async (file: File) => {
    setError(null);
    setDocument(null);
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/pdf', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to upload PDF');
      }
      const data = (await res.json()) as UploadResponse;
      // Store document info: this switches us from upload mode to reader mode
      setDocument(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to upload PDF';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear document and return to upload mode
  const clearDocument = () => {
    setDocument(null);
    setFileName(null);
  };

  // Render text reader when document is loaded
  // TODO: This will be replaced with the text-based reader component
  if (document) {
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

        {/* Document Header */}
        <div className="flex items-center justify-between border-b bg-background/80 px-4 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {fileName || 'Document'}
            </span>
            <span className="text-xs text-muted-foreground">
              ({document.numPages} {document.numPages === 1 ? 'page' : 'pages'})
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearDocument}
            className="size-8 p-0"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Text Reader Content - Placeholder */}
        <div className="flex flex-1 items-center justify-center overflow-auto p-6">
          <p className="text-sm text-muted-foreground">
            Text reader will be implemented here
          </p>
        </div>
      </motion.div>
    );
  }

  // Render upload UI when no document is loaded
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
        <motion.div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/40 hover:border-primary/60 hover:bg-muted/40'
          }`}
          onClick={handleBrowse}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Upload className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Drop your PDF here
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse your computer
            </p>
          </div>
          <Button variant="default" size="sm" className="mt-2">
            Choose file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </motion.div>

        <div className="mt-6 space-y-3 text-sm">
          {isLoading && (
            <p className="text-muted-foreground">
              Uploading and parsing PDF...
            </p>
          )}
          {error && <p className="text-destructive">Error: {error}</p>}
        </div>

        {fileName && !document && (
          <div className="mt-4 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-foreground">
            <FileText className="size-4 text-muted-foreground" />
            <span className="truncate">Selected: {fileName}</span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
