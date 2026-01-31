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
} from 'drizzle-orm/pg-core';

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

export const highlight = pgTable(
  'Highlight',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id),
    documentType: varchar('documentType', {
      enum: ['epub', 'pdf', 'article'],
    }).notNull(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    anchor: jsonb('anchor').notNull(), // { chapterIndex, startOffset, endOffset }
    selectedText: text('selectedText').notNull(),
    color: varchar('color', {
      enum: ['yellow', 'green', 'blue', 'pink', 'purple'],
    })
      .notNull()
      .default('yellow'),
    note: text('note'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentIdx: index('highlight_document_idx').on(table.documentId),
    userIdx: index('highlight_user_idx').on(table.userId),
    documentUserIdx: index('highlight_document_user_idx').on(
      table.documentId,
      table.userId
    ),
  })
);

export type Highlight = InferSelectModel<typeof highlight>;

export const annotation = pgTable(
  'Annotation',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId')
      .notNull()
      .references(() => document.id),
    documentType: varchar('documentType', {
      enum: ['epub', 'pdf', 'article'],
    }).notNull(),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    anchor: jsonb('anchor').notNull(), // { chapterIndex, startOffset, endOffset }
    selectedText: text('selectedText').notNull(),
    type: varchar('type', {
      enum: ['qa', 'comment', 'marker', 'note-quote'],
    }).notNull(),
    content: jsonb('content').notNull(), // Structure varies by type
    color: varchar('color', {
      enum: ['orange', 'yellow', 'green', 'blue', 'pink', 'purple'],
    })
      .notNull()
      .default('orange'),
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
    typeIdx: index('annotation_type_idx').on(table.type),
  })
);

export type Annotation = InferSelectModel<typeof annotation>;

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
