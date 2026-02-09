import 'server-only';

import { and, asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  document as documentTable,
  documentOutline as documentOutlineTable,
  documentSection as documentSectionTable,
} from './schema';

import type {
  InsertDocument,
  InsertDocumentOutline,
  InsertDocumentSection,
} from './types';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

/**
 * Create a document with its sections and optional outline in a single transaction
 */
export async function createDocumentWithSections({
  document,
  sections,
  outline,
}: {
  document: InsertDocument;
  sections: Array<InsertDocumentSection>;
  outline?: Array<InsertDocumentOutline>;
}) {
  return db.transaction(async (tx) => {
    await tx.insert(documentTable).values(document);
    if (sections.length) {
      await tx.insert(documentSectionTable).values(sections);
    }
    if (outline?.length) {
      await tx.insert(documentOutlineTable).values(outline);
    }
    return document;
  });
}

/**
 * Get a document with all its sections and outline
 */
export async function getDocumentWithSections(documentId: string) {
  const [doc] = await db
    .select()
    .from(documentTable)
    .where(eq(documentTable.id, documentId))
    .limit(1);
  if (!doc) return null;

  const sections = await db
    .select()
    .from(documentSectionTable)
    .where(eq(documentSectionTable.documentId, documentId))
    .orderBy(asc(documentSectionTable.index));

  const outline = await db
    .select()
    .from(documentOutlineTable)
    .where(eq(documentOutlineTable.documentId, documentId))
    .orderBy(asc(documentOutlineTable.order));

  return { doc, sections, outline };
}

/**
 * Get a single section by document ID and index
 */
export async function getDocumentSection(documentId: string, index: number) {
  const [section] = await db
    .select()
    .from(documentSectionTable)
    .where(
      and(
        eq(documentSectionTable.documentId, documentId),
        eq(documentSectionTable.index, index)
      )
    )
    .limit(1);
  return section ?? null;
}

/**
 * Get a section by its ID
 */
export async function getDocumentSectionById(sectionId: string) {
  const [section] = await db
    .select()
    .from(documentSectionTable)
    .where(eq(documentSectionTable.id, sectionId))
    .limit(1);
  return section ?? null;
}

/**
 * Get all sections for a document (metadata only, without content)
 */
export async function getDocumentSectionList(documentId: string) {
  return db
    .select({
      id: documentSectionTable.id,
      index: documentSectionTable.index,
      title: documentSectionTable.title,
    })
    .from(documentSectionTable)
    .where(eq(documentSectionTable.documentId, documentId))
    .orderBy(asc(documentSectionTable.index));
}

/**
 * Get section count for a document
 */
export async function getDocumentSectionCount(documentId: string) {
  const sections = await db
    .select({ id: documentSectionTable.id })
    .from(documentSectionTable)
    .where(eq(documentSectionTable.documentId, documentId));
  return sections.length;
}

/**
 * Update a section's content (for saving annotation marks)
 */
export async function updateSectionContent(
  documentId: string,
  index: number,
  content: unknown // TipTap JSON
) {
  const [result] = await db
    .update(documentSectionTable)
    .set({ content })
    .where(
      and(
        eq(documentSectionTable.documentId, documentId),
        eq(documentSectionTable.index, index)
      )
    )
    .returning();
  return result ?? null;
}
