import 'server-only';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql } from 'drizzle-orm';

import { documentChunk as documentChunkTable } from './schema';
import type { InsertDocumentChunk } from './types';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function insertDocumentChunks(chunks: Array<InsertDocumentChunk>) {
  if (chunks.length === 0) return [];
  return db.insert(documentChunkTable).values(chunks);
}

export async function deleteDocumentChunksByDocumentId(documentId: string) {
  return db
    .delete(documentChunkTable)
    .where(eq(documentChunkTable.fileId, documentId));
}

export async function getTopDocumentChunksByEmbedding({
  documentId,
  embedding,
  limit,
}: {
  documentId: string;
  embedding: number[];
  limit: number;
}) {
  return db.execute(
    sql`
      select
        id,
        "fileId",
        path,
        "mimeType",
        page,
        tab,
        text,
        md5,
        "modifiedTime",
        "updatedAt",
        embedding <-> ${sql.raw(`ARRAY[${embedding.join(',')}]::vector`)} as similarity
      from "DocumentChunk"
      where "fileId" = ${documentId}
      order by embedding <-> ${sql.raw(`ARRAY[${embedding.join(',')}]::vector`)} asc
      limit ${limit}
    `,
  );
}
