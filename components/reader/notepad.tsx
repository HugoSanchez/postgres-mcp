"use client";

import { useState, useRef, useEffect } from "react";
import { FileText, Eye, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface NotepadProps {
  content: string;
  onContentChange: (content: string) => void;
}

export function Notepad({ content, onContentChange }: NotepadProps) {
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && !isPreview) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content, isPreview]);

  // Focus textarea when switching to edit mode
  useEffect(() => {
    if (!isPreview && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isPreview]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPreview(false)}
            className={cn(
              "h-7 px-2 gap-1.5 text-xs",
              !isPreview && "bg-secondary"
            )}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPreview(true)}
            className={cn(
              "h-7 px-2 gap-1.5 text-xs",
              isPreview && "bg-secondary"
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
      </div>

      {/* Content area */}
      <ScrollArea className="flex-1">
        {isPreview ? (
          <div className="p-4">
            {content.trim() ? (
              <div className="prose prose-invert prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-em:text-foreground/90 prose-code:text-accent prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-accent prose-blockquote:text-muted-foreground prose-ul:text-foreground/90 prose-ol:text-foreground/90 prose-li:marker:text-muted-foreground">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No notes yet. Switch to edit mode to start writing.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            {content === "" && (
              <div className="absolute pointer-events-none text-muted-foreground text-sm leading-relaxed">
                Start writing your notes...
                <br />
                <br />
                <span className="text-xs">
                  Supports **bold**, *italic*, `code`, and more.
                </span>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              className="w-full min-h-[300px] bg-transparent text-foreground text-sm leading-relaxed resize-none focus:outline-none font-mono"
              placeholder=""
            />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
