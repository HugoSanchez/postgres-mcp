'use client';

import { useRef, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { motion } from 'framer-motion';

import { SidebarToggle } from '../sidebar-toggle';
import { Button } from '../ui/button';
import { useSidebar } from '../ui/sidebar';

export function ReadingPane() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
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
    // TODO: wire up actual upload + parsing flow.
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
    // TODO: wire up actual upload + parsing flow.
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleBrowse();
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

        {fileName && (
          <div className="mt-4 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-foreground">
            <FileText className="size-4 text-muted-foreground" />
            <span className="truncate">Selected: {fileName}</span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
