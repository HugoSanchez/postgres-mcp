import 'server-only';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  document as documentTable,
  documentOutline as documentOutlineTable,
  documentPage as documentPageTable,
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

