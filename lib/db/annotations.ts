import 'server-only';

import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { annotation as annotationTable } from './schema';
import type {
  AnnotationRow,
  EpubHighlightAnchor,
  AnnotationType,
  AnnotationColor,
  AnnotationContent,
  DocumentType,
} from './types';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

/**
 * Create a new annotation
 */
export async function createAnnotation(data: {
  documentId: string;
  documentType: DocumentType;
  userId: string;
  anchor: EpubHighlightAnchor;
  selectedText: string;
  type: AnnotationType;
  content: AnnotationContent;
  color?: AnnotationColor;
}): Promise<AnnotationRow> {
  const now = new Date();
  const [result] = await db
    .insert(annotationTable)
    .values({
      ...data,
      color: data.color || 'orange',
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return result;
}

/**
 * Get all annotations for a document and chapter
 */
export async function getAnnotationsByChapter(
  documentId: string,
  chapterIndex: number,
  userId: string,
  type?: AnnotationType
): Promise<AnnotationRow[]> {
  const annotations = await db
    .select()
    .from(annotationTable)
    .where(
      and(
        eq(annotationTable.documentId, documentId),
        eq(annotationTable.userId, userId),
        type ? eq(annotationTable.type, type) : undefined
      )
    );

  // Filter by chapter index from the JSONB anchor field
  return annotations.filter((a) => {
    const anchor = a.anchor as EpubHighlightAnchor;
    return anchor.chapterIndex === chapterIndex;
  });
}

/**
 * Get all annotations for a document (all chapters)
 */
export async function getAnnotationsByDocument(
  documentId: string,
  userId: string,
  type?: AnnotationType
): Promise<AnnotationRow[]> {
  return db
    .select()
    .from(annotationTable)
    .where(
      and(
        eq(annotationTable.documentId, documentId),
        eq(annotationTable.userId, userId),
        type ? eq(annotationTable.type, type) : undefined
      )
    );
}

/**
 * Get a single annotation by ID
 */
export async function getAnnotationById(
  annotationId: string
): Promise<AnnotationRow | null> {
  const [result] = await db
    .select()
    .from(annotationTable)
    .where(eq(annotationTable.id, annotationId))
    .limit(1);
  return result ?? null;
}

/**
 * Update an annotation (color or content)
 */
export async function updateAnnotation(
  annotationId: string,
  userId: string,
  data: { color?: AnnotationColor; content?: AnnotationContent }
): Promise<AnnotationRow | null> {
  const [result] = await db
    .update(annotationTable)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(annotationTable.id, annotationId),
        eq(annotationTable.userId, userId)
      )
    )
    .returning();
  return result ?? null;
}

/**
 * Delete an annotation (with ownership check)
 */
export async function deleteAnnotation(
  annotationId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(annotationTable)
    .where(
      and(
        eq(annotationTable.id, annotationId),
        eq(annotationTable.userId, userId)
      )
    )
    .returning({ id: annotationTable.id });
  return result.length > 0;
}
