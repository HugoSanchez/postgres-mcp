"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownEditor } from "./markdown-editor";

interface NotepadProps {
  content: string;
  onContentChange: (content: string) => void;
  scrollToQuoteText?: string | null;
  onScrollToQuoteComplete?: () => void;
  onQuoteClick?: (quoteText: string) => void;
}

export function Notepad({
  content,
  onContentChange,
  scrollToQuoteText,
  onScrollToQuoteComplete,
  onQuoteClick,
}: NotepadProps) {

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <MarkdownEditor
          content={content}
          onContentChange={onContentChange}
          placeholder="Start writing your notes... Use markdown for formatting."
          scrollToQuoteText={scrollToQuoteText}
          onScrollToQuoteComplete={onScrollToQuoteComplete}
          onQuoteClick={onQuoteClick}
        />
      </ScrollArea>
    </div>
  );
}
