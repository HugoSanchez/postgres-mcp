import type {
  document,
  documentOutline,
  documentPage,
  epubChapter,
  highlight,
  annotation,
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

// Annotation types
export type AnnotationRow = typeof annotation.$inferSelect;
export type InsertAnnotation = typeof annotation.$inferInsert;

export type AnnotationType = 'qa' | 'comment' | 'marker';
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

export type AnnotationContent = QAContent | CommentContent | MarkerContent;

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
