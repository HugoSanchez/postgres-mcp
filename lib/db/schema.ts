import type { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  json,
  uuid,
  text,
  primaryKey,
  foreignKey,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
  real,
  customType,
} from 'drizzle-orm/pg-core';

const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .slice(1, -1)
      .split(',')
      .map((v) => Number.parseFloat(v.trim()));
  },
});

export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://github.com/vercel/ai-chatbot/blob/main/docs/04-migrate-to-parts.md
export const messageDeprecated = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  content: json('content').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable('Message_v2', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://github.com/vercel/ai-chatbot/blob/main/docs/04-migrate-to-parts.md
export const voteDeprecated = pgTable(
  'Vote',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  'Vote_v2',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  'Document',
  {
    id: uuid('id').notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    title: text('title').notNull(),
    originalFilename: text('originalFilename'),
    mimeType: text('mimeType'),
    sizeBytes: integer('sizeBytes'),
    blobUrl: text('blobUrl'),
    checksumSha256: text('checksumSha256'),
    pageCount: integer('pageCount'),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
      checksumIdx: index('document_checksum_idx').on(table.checksumSha256),
      documentIdUnique: uniqueIndex('document_id_unique').on(table.id),
    };
  },
);

export type Document = InferSelectModel<typeof document>;

export const documentPage = pgTable(
  'DocumentPage',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id),
    pageIndex: integer('pageIndex').notNull(),
    text: text('text'),
    spans: jsonb('spans'),
    hasOcr: boolean('hasOcr').notNull().default(false),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    docIdx: index('document_page_doc_idx').on(table.documentId),
  }),
);

export const documentOutline = pgTable(
  'DocumentOutline',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id),
    title: text('title').notNull(),
    pageIndex: integer('pageIndex').notNull(),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    docIdx: index('document_outline_doc_idx').on(table.documentId),
  }),
);

export const documentChunk = pgTable(
  'DocumentChunk',
  {
    id: text('id').notNull(),
    fileId: uuid('fileId')
      .notNull()
      .references(() => document.id),
    path: text('path').notNull(),
    mimeType: text('mimeType').notNull(),
    page: integer('page'),
    tab: text('tab'),
    text: text('text').notNull(),
    embedding: vector1536('embedding').notNull(),
    md5: text('md5'),
    modifiedTime: timestamp('modifiedTime'),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    fileIdx: index('document_chunk_file_idx').on(table.fileId),
  }),
);

export const suggestion = pgTable(
  'Suggestion',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId').notNull(),
    documentCreatedAt: timestamp('documentCreatedAt').notNull(),
    originalText: text('originalText').notNull(),
    suggestedText: text('suggestedText').notNull(),
    description: text('description'),
    isResolved: boolean('isResolved').notNull().default(false),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  }),
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const epubChapter = pgTable(
  'EpubChapter',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id),
    spineIndex: integer('spineIndex').notNull(),
    href: text('href').notNull(),
    title: text('title').notNull(),
    html: text('html').notNull(),
    text: text('text').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    docIdx: index('epub_chapter_doc_idx').on(table.documentId),
    spineIdx: index('epub_chapter_spine_idx').on(
      table.documentId,
      table.spineIndex
    ),
  })
);

export type EpubChapter = InferSelectModel<typeof epubChapter>;

// New unified document sections table (replaces epubChapter)
// Stores TipTap JSON content for all document types
export const documentSection = pgTable(
  'DocumentSection',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id),
    index: integer('index').notNull(), // ordering within document
    title: text('title'), // optional, for TOC navigation
    content: jsonb('content').notNull(), // TipTap JSON (source of truth)
    textContent: text('textContent').notNull(), // plain text for RAG/search
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    docIdx: index('document_section_doc_idx').on(table.documentId),
    docIndexIdx: uniqueIndex('document_section_doc_index_idx').on(
      table.documentId,
      table.index
    ),
  })
);

export type DocumentSection = InferSelectModel<typeof documentSection>;

// Unified annotation table - stores all annotation types
// Annotations are anchored via TipTap marks in the document content
export const annotation = pgTable(
  'Annotation',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id),
    sectionIndex: integer('sectionIndex').notNull(), // which section contains this annotation
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    type: varchar('type', {
      enum: ['highlight', 'comment', 'ai-response', 'quote'],
    }).notNull(),
    selectedText: text('selectedText').notNull(), // snapshot of the marked text
    content: jsonb('content'), // type-specific data: { note?, comment?, question?, answer?, noteId? }
    color: varchar('color', {
      enum: ['yellow', 'green', 'blue', 'pink', 'purple', 'orange'],
    })
      .notNull()
      .default('yellow'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentIdx: index('annotation_document_idx').on(table.documentId),
    userIdx: index('annotation_user_idx').on(table.userId),
    documentUserIdx: index('annotation_document_user_idx').on(
      table.documentId,
      table.userId
    ),
    sectionIdx: index('annotation_section_idx').on(
      table.documentId,
      table.sectionIndex
    ),
    typeIdx: index('annotation_type_idx').on(table.type),
  })
);

export type Annotation = InferSelectModel<typeof annotation>;

// Type definitions for annotation content
export type HighlightContent = {
  note?: string;
};

export type CommentContent = {
  comment: string;
};

export type AIResponseContent = {
  question: string;
  answer: string;
  model?: string;
};

export type QuoteContent = {
  noteId: string; // reference to DocumentNote
};

export const readingProgress = pgTable(
  'ReadingProgress',
  {
    id: uuid('id').notNull().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id),
    documentType: varchar('documentType', {
      enum: ['epub', 'pdf', 'article'],
    }).notNull(),
    chapterIndex: integer('chapterIndex'), // nullable for non-chapter docs
    scrollPosition: real('scrollPosition').notNull().default(0), // 0-1 percentage
    lastReadAt: timestamp('lastReadAt').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    userDocumentUnique: uniqueIndex('reading_progress_user_document_idx').on(
      table.userId,
      table.documentId
    ),
    userIdx: index('reading_progress_user_idx').on(table.userId),
    lastReadIdx: index('reading_progress_last_read_idx').on(table.lastReadAt),
  })
);

export type ReadingProgress = InferSelectModel<typeof readingProgress>;

export const documentNote = pgTable(
  'DocumentNote',
  {
    id: uuid('id').notNull().defaultRandom(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id),
    documentType: varchar('documentType', {
      enum: ['epub', 'pdf', 'article'],
    }).notNull(),
    title: varchar('title', { length: 255 }), // nullable for future multi-note UI
    content: text('content').notNull().default(''),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    userDocumentIdx: index('document_note_user_document_idx').on(
      table.userId,
      table.documentId
    ),
    userIdx: index('document_note_user_idx').on(table.userId),
  })
);

export type DocumentNote = InferSelectModel<typeof documentNote>;
