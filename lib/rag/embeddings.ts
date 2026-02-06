import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function embedTexts(values: string[], batchSize = 100) {
  const embeddings: number[][] = [];

  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    const { embeddings: batchEmbeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: batch,
    });
    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
}
