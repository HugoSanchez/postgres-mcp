import { cookies } from 'next/headers';

import { Chat } from '@/components/chat';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { ReadingPane } from '@/components/reader/reading-pane';

export default async function Page() {
  const id = generateUUID();

  const cookieStore = await cookies();
  const selectedChatModel =
    cookieStore.get('chat-model')?.value ?? DEFAULT_CHAT_MODEL;

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-2">
      <section className="hidden h-full flex-col border-r bg-muted/30 md:flex">
        <ReadingPane />
      </section>

      <section className="flex min-w-0 flex-col">
        <Chat
          key={id}
          id={id}
          initialMessages={[]}
          selectedChatModel={selectedChatModel}
          selectedVisibilityType="private"
          isReadonly={false}
        />
        <DataStreamHandler id={id} />
      </section>
    </div>
  );
}
