'use client';

import { motion } from 'framer-motion';

import { EpubUploader } from './epub-uploader';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { useSidebar } from '@/components/ui/sidebar';

export function HomeScreen() {
  const { open } = useSidebar();

  return (
    <div className="relative flex h-dvh flex-col items-center justify-center bg-background p-6">
      {!open && (
        <div className="absolute left-4 top-4 z-10">
          <SidebarToggle className="md:px-2 md:h-fit" />
        </div>
      )}

      <div className="flex flex-col items-center gap-8 w-full max-w-lg">
        {/* Welcome Message */}
        <motion.div
          className="flex flex-col items-center gap-3 text-center"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Welcome to Kathmandu
          </h1>
          <p className="text-base text-muted-foreground max-w-sm">
            Upload an EPUB to start reading. Your progress will be saved
            automatically.
          </p>
        </motion.div>

        {/* EPUB Uploader */}
        <EpubUploader />
      </div>
    </div>
  );
}
