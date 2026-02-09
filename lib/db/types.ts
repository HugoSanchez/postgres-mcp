import type {
  document,
  documentOutline,
  documentPage,
  documentChunk,
  documentSection,
  epubChapter,
  annotation,
  readingProgress,
  documentNote,
} from './schema';

export type DocumentRow = typeof document.$inferSelect;
export type InsertDocument = typeof document.$inferInsert;

export type DocumentPageRow = typeof documentPage.$inferSelect;
export type InsertDocumentPage = typeof documentPage.$inferInsert;

export type DocumentOutlineRow = typeof documentOutline.$inferSelect;
export type InsertDocumentOutline = typeof documentOutline.$inferInsert;

export type DocumentChunkRow = typeof documentChunk.$inferSelect;
export type InsertDocumentChunk = typeof documentChunk.$inferInsert;

export type EpubChapterRow = typeof epubChapter.$inferSelect;
export type InsertEpubChapter = typeof epubChapter.$inferInsert;

export type DocumentSectionRow = typeof documentSection.$inferSelect;
export type InsertDocumentSection = typeof documentSection.$inferInsert;

export type DocumentType = 'epub' | 'pdf' | 'article';

export type ReadingProgressRow = typeof readingProgress.$inferSelect;
export type InsertReadingProgress = typeof readingProgress.$inferInsert;

export type DocumentNoteRow = typeof documentNote.$inferSelect;
export type InsertDocumentNote = typeof documentNote.$inferInsert;

// Unified Annotation types (replaces old Highlight and Annotation tables)
export type AnnotationRow = typeof annotation.$inferSelect;
export type InsertAnnotation = typeof annotation.$inferInsert;

export type AnnotationType = 'highlight' | 'comment' | 'ai-response' | 'quote';
export type AnnotationColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'orange';

// Content types for different annotation kinds
export interface HighlightContent {
  note?: string;
}

export interface CommentContent {
  comment: string;
}

export interface AIResponseContent {
  question: string;
  answer: string;
  model?: string;
}

export interface QuoteContent {
  noteId: string;
}

export type AnnotationContentType = HighlightContent | CommentContent | AIResponseContent | QuoteContent;
