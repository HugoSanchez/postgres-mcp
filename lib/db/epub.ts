import 'server-only';

import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  document as documentTable,
  documentOutline as documentOutlineTable,
  epubChapter as epubChapterTable,
} from './schema';

import type {
  InsertDocument,
  InsertDocumentOutline,
  InsertEpubChapter,
} from './types';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

/**
 * Create an EPUB document with its chapters and outline in a single transaction
 */
export async function createEpubWithChapters({
  document,
  chapters,
  outline,
}: {
  document: InsertDocument;
  chapters: Array<InsertEpubChapter>;
  outline?: Array<InsertDocumentOutline>;
}) {
  return db.transaction(async (tx) => {
    await tx.insert(documentTable).values(document);
    if (chapters.length) {
      await tx.insert(epubChapterTable).values(chapters);
    }
    if (outline?.length) {
      await tx.insert(documentOutlineTable).values(outline);
    }
    return document;
  });
}

/**
 * Get an EPUB document with all its chapters and outline
 */
export async function getEpubWithChapters(documentId: string) {
  const [doc] = await db
    .select()
    .from(documentTable)
    .where(eq(documentTable.id, documentId))
    .limit(1);
  if (!doc) return null;

  const chapters = await db
    .select()
    .from(epubChapterTable)
    .where(eq(epubChapterTable.documentId, documentId))
    .orderBy(asc(epubChapterTable.spineIndex));

  const outline = await db
    .select()
    .from(documentOutlineTable)
    .where(eq(documentOutlineTable.documentId, documentId))
    .orderBy(asc(documentOutlineTable.order));

  return { doc, chapters, outline };
}

/**
 * Get a single chapter by document ID and spine index
 */
export async function getEpubChapter(documentId: string, spineIndex: number) {
  const [chapter] = await db
    .select()
    .from(epubChapterTable)
    .where(eq(epubChapterTable.documentId, documentId))
    .orderBy(asc(epubChapterTable.spineIndex))
    .offset(spineIndex)
    .limit(1);
  return chapter ?? null;
}

/**
 * Get a chapter by its ID
 */
export async function getEpubChapterById(chapterId: string) {
  const [chapter] = await db
    .select()
    .from(epubChapterTable)
    .where(eq(epubChapterTable.id, chapterId))
    .limit(1);
  return chapter ?? null;
}

/**
 * Get all chapters for a document (just metadata, without HTML content)
 */
export async function getEpubChapterList(documentId: string) {
  return db
    .select({
      id: epubChapterTable.id,
      spineIndex: epubChapterTable.spineIndex,
      href: epubChapterTable.href,
      title: epubChapterTable.title,
    })
    .from(epubChapterTable)
    .where(eq(epubChapterTable.documentId, documentId))
    .orderBy(asc(epubChapterTable.spineIndex));
}
