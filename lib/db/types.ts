import type {
  document,
  documentOutline,
  documentPage,
  documentChunk,
  epubChapter,
  highlight,
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

export type DocumentNoteRow = typeof documentNote.$inferSelect;
export type InsertDocumentNote = typeof documentNote.$inferInsert;

// Annotation types
export type AnnotationRow = typeof annotation.$inferSelect;
export type InsertAnnotation = typeof annotation.$inferInsert;

export type AnnotationType = 'qa' | 'comment' | 'marker' | 'note-quote';
export type AnnotationColor = 'orange' | 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

// Content types for different annotation kinds
export interface QAContent {
  question: string;
  answer: string;
}

export interface CommentContent {
  text: string;
}

export interface MarkerContent {
  symbol: '!!' | '?' | '***' | 'bookmark';
}

// Empty object - note-quote stores quote text in selectedText field
export type NoteQuoteContent = Record<string, never>;

export type AnnotationContent = QAContent | CommentContent | MarkerContent | NoteQuoteContent;

// Type guards for narrowing content type
export function isQAContent(content: AnnotationContent): content is QAContent {
  return 'question' in content && 'answer' in content;
}

export function isCommentContent(content: AnnotationContent): content is CommentContent {
  return 'text' in content && !('question' in content);
}

export function isMarkerContent(content: AnnotationContent): content is MarkerContent {
  return 'symbol' in content;
}

export function isNoteQuoteContent(content: AnnotationContent): content is NoteQuoteContent {
  return !('question' in content) && !('text' in content) && !('symbol' in content);
}
