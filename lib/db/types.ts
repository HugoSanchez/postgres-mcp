import type {
  document,
  documentOutline,
  documentPage,
  epubChapter,
  highlight,
  readingProgress,
} from './schema';

export type DocumentRow = typeof document.$inferSelect;
export type InsertDocument = typeof document.$inferInsert;

export type DocumentPageRow = typeof documentPage.$inferSelect;
export type InsertDocumentPage = typeof documentPage.$inferInsert;

export type DocumentOutlineRow = typeof documentOutline.$inferSelect;
export type InsertDocumentOutline = typeof documentOutline.$inferInsert;

export type EpubChapterRow = typeof epubChapter.$inferSelect;
export type InsertEpubChapter = typeof epubChapter.$inferInsert;

export type HighlightRow = typeof highlight.$inferSelect;
export type InsertHighlight = typeof highlight.$inferInsert;

// EPUB-specific anchor type
export interface EpubHighlightAnchor {
  chapterIndex: number;
  startOffset: number;
  endOffset: number;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
export type DocumentType = 'epub' | 'pdf' | 'article';

export type ReadingProgressRow = typeof readingProgress.$inferSelect;
export type InsertReadingProgress = typeof readingProgress.$inferInsert;

