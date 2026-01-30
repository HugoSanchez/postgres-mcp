import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { auth } from '@/app/(auth)/auth';

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

    const { messages, documentTitle, context } = await request.json() as {
      messages: ChatMessage[];
      documentTitle?: string;
      context?: string;
    };

    if (!messages || messages.length === 0) {
      return new Response('No messages provided', { status: 400 });
    }

    const systemPrompt = `You are a helpful reading assistant. ${
      documentTitle ? `The user is currently reading "${documentTitle}".` : ''
    }${
      context ? ` They have selected the following text for context: "${context}"` : ''
    }

Help the user understand the text, answer questions about it, define words, explain concepts, and provide relevant context. Keep your responses concise and focused on what they're asking about.`;

    const result = streamText({
      model: anthropic('claude-3-haiku-20240307'),
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
