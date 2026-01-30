"use client";

import { FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownEditor } from "./markdown-editor";

interface NotepadProps {
  content: string;
  onContentChange: (content: string) => void;
}

export function Notepad({ content, onContentChange }: NotepadProps) {
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>Notes</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
      </div>

      {/* Editor */}
      <ScrollArea className="flex-1">
        <MarkdownEditor
          content={content}
          onContentChange={onContentChange}
          placeholder="Start writing your notes... Use markdown for formatting."
        />
      </ScrollArea>
    </div>
  );
}
