import 'server-only';

import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  annotation as annotationTable,
  document as documentTable,
  documentOutline as documentOutlineTable,
  documentPage as documentPageTable,
  documentNote as documentNoteTable,
  epubChapter as epubChapterTable,
  highlight as highlightTable,
  readingProgress as readingProgressTable,
  suggestion as suggestionTable,
} from './schema';

import type {
  InsertDocument,
  InsertDocumentOutline,
  InsertDocumentPage,
} from './types';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function createDocumentWithPages({
  document,
  pages,
  outline,
}: {
  document: InsertDocument;
  pages: Array<InsertDocumentPage>;
  outline?: Array<InsertDocumentOutline>;
}) {
  return db.transaction(async (tx) => {
    await tx.insert(documentTable).values(document);
    if (pages.length) {
      await tx.insert(documentPageTable).values(pages);
    }
    if (outline?.length) {
      await tx.insert(documentOutlineTable).values(outline);
    }
    return document;
  });
}

export async function findDocumentByChecksum(checksumSha256: string) {
  const [doc] = await db
    .select()
    .from(documentTable)
    .where(eq(documentTable.checksumSha256, checksumSha256))
    .limit(1);
  return doc ?? null;
}

export async function getDocumentWithPages(documentId: string) {
  const [doc] = await db
    .select()
    .from(documentTable)
    .where(eq(documentTable.id, documentId))
    .limit(1);
  if (!doc) return null;

  const pages = await db
    .select()
    .from(documentPageTable)
    .where(eq(documentPageTable.documentId, documentId))
    .orderBy(documentPageTable.pageIndex);

  const outline = await db
    .select()
    .from(documentOutlineTable)
    .where(eq(documentOutlineTable.documentId, documentId))
    .orderBy(documentOutlineTable.order);

  return { doc, pages, outline };
}

export async function getDocumentById(documentId: string) {
  const [doc] = await db
    .select()
    .from(documentTable)
    .where(eq(documentTable.id, documentId))
    .limit(1);
  return doc ?? null;
}

export async function renameDocument(
  documentId: string,
  title: string
) {
  const [updated] = await db
    .update(documentTable)
    .set({ title, updatedAt: new Date() })
    .where(eq(documentTable.id, documentId))
    .returning();
  return updated ?? null;
}

export async function deleteDocumentById(documentId: string) {
  return db.transaction(async (tx) => {
    const [doc] = await tx
      .select()
      .from(documentTable)
      .where(eq(documentTable.id, documentId))
      .limit(1);

    if (!doc) return false;

    await tx
      .delete(suggestionTable)
      .where(
        and(
          eq(suggestionTable.documentId, documentId),
          eq(suggestionTable.documentCreatedAt, doc.createdAt)
        )
      );

    await tx
      .delete(documentOutlineTable)
      .where(eq(documentOutlineTable.documentId, documentId));

    await tx
      .delete(documentPageTable)
      .where(eq(documentPageTable.documentId, documentId));

    await tx
      .delete(epubChapterTable)
      .where(eq(epubChapterTable.documentId, documentId));

    await tx
      .delete(highlightTable)
      .where(eq(highlightTable.documentId, documentId));

    await tx
      .delete(annotationTable)
      .where(eq(annotationTable.documentId, documentId));

    await tx
      .delete(documentNoteTable)
      .where(eq(documentNoteTable.documentId, documentId));

    await tx
      .delete(readingProgressTable)
      .where(eq(readingProgressTable.documentId, documentId));

    await tx
      .delete(documentTable)
      .where(eq(documentTable.id, documentId));

    return true;
  });
}
