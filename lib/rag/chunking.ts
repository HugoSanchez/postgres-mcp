import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export interface ChunkSource {
  text: string;
  page?: number | null;
}

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
});

export async function splitIntoChunks(sources: ChunkSource[]) {
  const texts = sources.map((source) => source.text);
  const metadatas = sources.map((source) => ({
    page: source.page ?? null,
  }));

  return splitter.createDocuments(texts, metadatas);
}
