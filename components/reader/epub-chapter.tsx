'use client';

import { motion } from 'framer-motion';

interface EpubChapterProps {
  title: string;
  html: string;
  className?: string;
}

/**
 * Renders a single EPUB chapter with sanitized HTML content
 * Uses Tailwind prose styling for consistent typography
 */
export function EpubChapter({ title, html, className = '' }: EpubChapterProps) {
  return (
    <motion.article
      className={`epub-chapter ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="
          prose prose-lg dark:prose-invert max-w-none
          prose-headings:font-semibold
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-img:rounded-lg prose-img:shadow-md prose-img:mx-auto
          prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r
          prose-pre:bg-muted prose-pre:text-foreground
          prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
          prose-table:overflow-x-auto prose-table:block prose-table:w-full
          prose-hr:border-border
          [&_.epub-chapter]:mb-0
          [&_section]:mb-8
          [&_aside]:border-l-2 [&_aside]:border-muted-foreground/30 [&_aside]:pl-4 [&_aside]:italic [&_aside]:text-muted-foreground
        "
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </motion.article>
  );
}
