import 'server-only';

import { and, eq, desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  annotation,
  type Annotation,
  type HighlightContent,
  type CommentContent,
  type AIResponseContent,
  type QuoteContent,
} from './schema';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

// Re-export types for convenience
export type {
  Annotation,
  HighlightContent,
  CommentContent,
  AIResponseContent,
  QuoteContent,
};

// Annotation type union
export type AnnotationType = 'highlight' | 'comment' | 'ai-response' | 'quote';
export type AnnotationColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'orange';
export type AnnotationContent = HighlightContent | CommentContent | AIResponseContent | QuoteContent;

// Type for creating a new annotation
export type CreateAnnotationInput = {
  id?: string; // Allow client to specify ID for TipTap mark sync
  documentId: string;
  sectionIndex: number;
  userId: string;
  type: AnnotationType;
  selectedText: string;
  content?: AnnotationContent;
  color?: AnnotationColor;
};

// Type for updating an annotation
export type UpdateAnnotationInput = {
  selectedText?: string;
  content?: AnnotationContent;
  color?: AnnotationColor;
};

/**
 * Create a new annotation
 */
export async function createAnnotation(
  input: CreateAnnotationInput
): Promise<Annotation> {
  const [result] = await db
    .insert(annotation)
    .values({
      id: input.id,
      documentId: input.documentId,
      sectionIndex: input.sectionIndex,
      userId: input.userId,
      type: input.type,
      selectedText: input.selectedText,
      content: input.content ?? null,
      color: input.color ?? 'yellow',
    })
    .returning();

  return result;
}

/**
 * Get a single annotation by ID
 */
export async function getAnnotation(id: string): Promise<Annotation | null> {
  const [result] = await db
    .select()
    .from(annotation)
    .where(eq(annotation.id, id))
    .limit(1);

  return result ?? null;
}

/**
 * Get all annotations for a document section
 */
export async function getAnnotationsForSection(
  documentId: string,
  sectionIndex: number,
  userId?: string
): Promise<Annotation[]> {
  const conditions = [
    eq(annotation.documentId, documentId),
    eq(annotation.sectionIndex, sectionIndex),
  ];

  if (userId) {
    conditions.push(eq(annotation.userId, userId));
  }

  return db
    .select()
    .from(annotation)
    .where(and(...conditions))
    .orderBy(desc(annotation.createdAt));
}

/**
 * Get all annotations for a document
 */
export async function getAnnotationsForDocument(
  documentId: string,
  userId?: string
): Promise<Annotation[]> {
  const conditions = [eq(annotation.documentId, documentId)];

  if (userId) {
    conditions.push(eq(annotation.userId, userId));
  }

  return db
    .select()
    .from(annotation)
    .where(and(...conditions))
    .orderBy(annotation.sectionIndex, desc(annotation.createdAt));
}

/**
 * Get all annotations for a user across all documents
 */
export async function getAnnotationsForUser(
  userId: string
): Promise<Annotation[]> {
  return db
    .select()
    .from(annotation)
    .where(eq(annotation.userId, userId))
    .orderBy(desc(annotation.createdAt));
}

/**
 * Get annotations by type for a document
 */
export async function getAnnotationsByType(
  documentId: string,
  type: AnnotationType,
  userId?: string
): Promise<Annotation[]> {
  const conditions = [
    eq(annotation.documentId, documentId),
    eq(annotation.type, type),
  ];

  if (userId) {
    conditions.push(eq(annotation.userId, userId));
  }

  return db
    .select()
    .from(annotation)
    .where(and(...conditions))
    .orderBy(desc(annotation.createdAt));
}

/**
 * Update an annotation
 */
export async function updateAnnotation(
  id: string,
  userId: string,
  input: UpdateAnnotationInput
): Promise<Annotation | null> {
  const [result] = await db
    .update(annotation)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(and(eq(annotation.id, id), eq(annotation.userId, userId)))
    .returning();

  return result ?? null;
}

/**
 * Delete an annotation (with ownership check)
 */
export async function deleteAnnotation(
  id: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(annotation)
    .where(and(eq(annotation.id, id), eq(annotation.userId, userId)))
    .returning({ id: annotation.id });

  return result.length > 0;
}

/**
 * Delete all annotations for a document
 */
export async function deleteAnnotationsForDocument(
  documentId: string,
  userId: string
): Promise<number> {
  const result = await db
    .delete(annotation)
    .where(
      and(eq(annotation.documentId, documentId), eq(annotation.userId, userId))
    )
    .returning({ id: annotation.id });

  return result.length;
}

/**
 * Batch create annotations (useful for importing)
 */
export async function createAnnotations(
  inputs: CreateAnnotationInput[]
): Promise<Annotation[]> {
  if (inputs.length === 0) return [];

  return db
    .insert(annotation)
    .values(
      inputs.map((input) => ({
        id: input.id,
        documentId: input.documentId,
        sectionIndex: input.sectionIndex,
        userId: input.userId,
        type: input.type,
        selectedText: input.selectedText,
        content: input.content ?? null,
        color: input.color ?? 'yellow',
      }))
    )
    .returning();
}

/**
 * Check if user owns an annotation
 */
export async function userOwnsAnnotation(
  annotationId: string,
  userId: string
): Promise<boolean> {
  const [result] = await db
    .select({ id: annotation.id })
    .from(annotation)
    .where(and(eq(annotation.id, annotationId), eq(annotation.userId, userId)))
    .limit(1);

  return !!result;
}
