import { embedMany, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { auth } from '@/app/(auth)/auth';
import { getTopDocumentChunksByEmbedding } from '@/lib/db/document-chunks';

export const maxDuration = 60;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { messages, documentId, documentTitle, context } = await request.json() as {
      messages: ChatMessage[];
      documentId?: string;
      documentTitle?: string;
      context?: string;
    };

    if (!messages || messages.length === 0) {
      return new Response('No messages provided', { status: 400 });
    }

    let ragContext = '';

    if (documentId) {
      try {
        const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
        const query = lastUserMessage?.content?.trim();
        if (query) {
          const { embeddings } = await embedMany({
            model: openai.embedding('text-embedding-3-small'),
            values: [query],
          });

          const results = await getTopDocumentChunksByEmbedding({
            documentId,
            embedding: embeddings[0],
            limit: 6,
          });

          const rows = 'rows' in results ? results.rows : results;
          const excerpts = rows
            .map((row: any, index: number) => {
              const pageLabel = typeof row.page === 'number' ? ` (page ${row.page + 1})` : '';
              return `Excerpt ${index + 1}${pageLabel}: ${row.text}`;
            })
            .join('\\n\\n');

          if (excerpts) {
            ragContext = `Relevant excerpts from the document:\\n${excerpts}`;
          }
        }
      } catch (error) {
        console.error('Failed to retrieve RAG context:', error);
      }
    }

    const systemPrompt = `You are a helpful reading assistant. ${
      documentTitle ? `The user is currently reading "${documentTitle}".` : ''
    }${
      context ? ` They have selected the following text for context: "${context}"` : ''
    }
${
  ragContext ? `\\n\\n${ragContext}` : ''
}

Help the user understand the text, answer questions about it, define words, explain concepts, and provide relevant context. Use the document excerpts as context, but feel free to draw on your broader knowledge to verify facts, provide additional background, or give more complete answers. Don't limit yourself to only what's explicitly stated in the excerpts. Keep your responses concise and focused on what they're asking about.`;

    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Reader chat error:', error);
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
