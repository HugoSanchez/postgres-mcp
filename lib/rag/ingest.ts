import { splitIntoChunks, type ChunkSource } from './chunking';
import { embedTexts } from './embeddings';
import { deleteDocumentChunksByDocumentId, insertDocumentChunks } from '@/lib/db/document-chunks';
import type { InsertDocumentChunk } from '@/lib/db/types';

export async function ingestDocumentChunks({
  documentId,
  title,
  mimeType,
  checksum,
  sources,
}: {
  documentId: string;
  title: string;
  mimeType: string | null;
  checksum: string | null;
  sources: ChunkSource[];
}) {
  const filteredSources = sources
    .map((source) => ({
      ...source,
      text: source.text.trim(),
    }))
    .filter((source) => source.text.length > 0);

  if (filteredSources.length === 0) return;

  const documents = await splitIntoChunks(filteredSources);
  const texts = documents.map((doc) => doc.pageContent);

  if (texts.length === 0) return;

  const embeddings = await embedTexts(texts);
  const now = new Date();

  const chunks: InsertDocumentChunk[] = documents.map((doc, index) => ({
    id: `${documentId}#${index}`,
    fileId: documentId,
    path: title,
    mimeType: mimeType ?? 'text/plain',
    page: typeof doc.metadata?.page === 'number' ? doc.metadata.page : null,
    tab: null,
    text: doc.pageContent,
    embedding: embeddings[index],
    md5: checksum ?? null,
    modifiedTime: now,
    updatedAt: now,
  }));

  await deleteDocumentChunksByDocumentId(documentId);
  await insertDocumentChunks(chunks);
}
