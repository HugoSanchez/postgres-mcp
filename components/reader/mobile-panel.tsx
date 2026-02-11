"use client";

import React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Pin, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Notepad } from "./notepad";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";
import type { DocumentType } from "@/lib/db/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Track Q&A pairs that can be saved as annotations
interface SaveableQA {
  question: string;
  answer: string;
  sectionIndex: number;
  selectedText: string;
}

interface SeedMessage {
  question: string;
  answer: string;
}

// Anchor type for backwards compatibility with existing props
interface ContextAnchor {
  chapterIndex: number;
  startOffset: number;
  endOffset: number;
}

interface MobilePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: string;
  contextAnchor: ContextAnchor | null;
  onClearContext: () => void;
  activeTab: "chat" | "notes";
  onTabChange: (tab: "chat" | "notes") => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  documentId: string;
  documentType: DocumentType;
  documentTitle?: string;
  onAnnotationCreated?: (sectionIndex: number) => void;
  seedMessages?: SeedMessage[] | null;
  onSeedMessagesConsumed?: () => void;
  scrollToQuoteText?: string | null;
  onScrollToQuoteComplete?: () => void;
  onQuoteClick?: (quoteText: string) => void;
}

export function MobilePanel({
  open,
  onOpenChange,
  context,
  contextAnchor,
  onClearContext,
  activeTab,
  onTabChange,
  notes,
  onNotesChange,
  documentId,
  documentType,
  documentTitle,
  onAnnotationCreated,
  seedMessages,
  onSeedMessagesConsumed,
  scrollToQuoteText,
  onScrollToQuoteComplete,
  onQuoteClick,
}: MobilePanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track saveable Q&A pairs (keyed by assistant message id)
  const saveableQAsRef = useRef<Map<string, SaveableQA>>(new Map());

  // Auto-populate input with context when panel opens
  useEffect(() => {
    if (open && context && input === "" && activeTab === "chat") {
      if (context.startsWith("Define:")) {
        setInput(context);
      } else {
        setInput(`What does this mean: "${context}"`);
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, context, input, activeTab]);

  // Seed chat with messages from annotation click (supports multiple Q&A pairs)
  useEffect(() => {
    if (seedMessages && seedMessages.length > 0) {
      const timestamp = Date.now();
      // Build messages array with all Q&A pairs
      const newMessages: Message[] = [];
      seedMessages.forEach((qa, index) => {
        newMessages.push(
          { id: `${timestamp}-q-${index}`, role: "user", content: qa.question },
          { id: `${timestamp}-a-${index}`, role: "assistant", content: qa.answer }
        );
      });
      setMessages(newMessages);
      onSeedMessagesConsumed?.();
    }
  }, [seedMessages, onSeedMessagesConsumed]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    const questionText = input.trim();
    setInput("");
    setIsTyping(true);

    // Capture anchor and context before clearing
    const currentContext = context;
    const currentAnchor = contextAnchor;
    onClearContext();

    try {
      const response = await fetch('/api/reader/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          documentId,
          documentTitle,
          context: currentContext,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const assistantMessageId = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { id: assistantMessageId, role: "assistant", content: "" }]);

      const decoder = new TextDecoder();
      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Parse the data stream format from AI SDK
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('0:')) {
            // Text chunk - parse the JSON string
            try {
              const textContent = JSON.parse(line.slice(2));
              accumulatedContent += textContent;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: accumulatedContent }
                    : m
                )
              );
            } catch {
              // Skip malformed chunks
            }
          }
        }
      }

      // After response complete, store saveable Q&A if we have context data
      if (currentAnchor && currentContext && accumulatedContent) {
        saveableQAsRef.current.set(assistantMessageId, {
          question: questionText,
          answer: accumulatedContent,
          sectionIndex: currentAnchor.chapterIndex, // chapterIndex is actually sectionIndex
          selectedText: currentContext,
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSave = useCallback(async (messageId: string) => {
    const qa = saveableQAsRef.current.get(messageId);
    if (!qa) return;

    setSavingMessageId(messageId);
    try {
      const response = await fetch('/api/annotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          sectionIndex: qa.sectionIndex,
          selectedText: qa.selectedText,
          type: 'ai-response',
          color: 'blue',
          content: {
            question: qa.question,
            answer: qa.answer,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save annotation');
      }

      setSavedMessageIds(prev => new Set([...prev, messageId]));
      // Remove from saveable map since it's now saved
      saveableQAsRef.current.delete(messageId);

      // Notify parent to refresh annotations for this section
      onAnnotationCreated?.(qa.sectionIndex);
    } catch (error) {
      console.error('Failed to save annotation:', error);
    } finally {
      setSavingMessageId(null);
    }
  }, [documentId, onAnnotationCreated]);

  return (
    <div
      className={cn(
        "fixed left-0 right-0 bottom-0 z-50 h-[60vh]",
        "bg-white dark:bg-background border-t border-border rounded-t-2xl shadow-2xl",
        "flex flex-col",
        "transition-transform duration-300 ease-out",
        open ? "translate-y-0" : "translate-y-full"
      )}
    >
      {/* Header with tabs and close */}
      <div className="px-3 py-2.5 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 p-1 rounded-lg bg-muted/50">
            <button
              type="button"
              onClick={() => onTabChange("chat")}
              className={cn(
                "flex-1 py-1.5 text-sm rounded-md transition-colors",
                activeTab === "chat"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => onTabChange("notes")}
              className={cn(
                "flex-1 py-1.5 text-sm rounded-md transition-colors",
                activeTab === "notes"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Notes
            </button>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === "chat" ? (
        <>
          {/* Messages area */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-start justify-center px-4 py-8">
                <p className="text-sm text-muted-foreground">
                  {documentTitle
                    ? `Ask anything about "${documentTitle}"...`
                    : 'Ask anything about the text...'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex flex-col",
                      message.role === "user" ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                        message.role === "user"
                          ? "bg-muted/70 text-foreground"
                          : "text-foreground prose prose-sm dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <Markdown>{message.content}</Markdown>
                      ) : (
                        message.content
                      )}
                    </div>
                    {message.role === "assistant" && saveableQAsRef.current.has(message.id) && !savedMessageIds.has(message.id) && (
                      <button
                        type="button"
                        onClick={() => handleSave(message.id)}
                        disabled={savingMessageId === message.id}
                        className="mt-1 flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        {savingMessageId === message.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Pin className="h-3 w-3" />
                        )}
                        {savingMessageId === message.id ? "Saving..." : "Pin to text"}
                      </button>
                    )}
                    {message.role === "assistant" && savedMessageIds.has(message.id) && (
                      <span className="mt-1 flex items-center gap-1 px-2 py-1 text-xs text-green-600 dark:text-green-400">
                        <Pin className="h-3 w-3" />
                        Pinned
                      </span>
                    )}
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl px-3 py-2.5">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input area */}
          <div className="p-3 pb-6 border-t border-border/50 shrink-0">
            {context && (
              <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                <span>{context.split(/\s+/).length} words selected</span>
                <button
                  type="button"
                  onClick={onClearContext}
                  className="text-muted-foreground/60 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the text..."
                className="w-full resize-none bg-muted/30 border border-border/50 rounded-lg px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-border min-h-[56px] max-h-[100px] scrollbar-none"
                rows={2}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className={cn(
                  "absolute bottom-2.5 right-2.5 p-1.5 rounded",
                  "text-muted-foreground hover:text-foreground",
                  "disabled:opacity-30 disabled:cursor-not-allowed",
                  "transition-colors"
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-hidden">
          <Notepad
            content={notes}
            onContentChange={onNotesChange}
            scrollToQuoteText={scrollToQuoteText}
            onScrollToQuoteComplete={onScrollToQuoteComplete}
            onQuoteClick={onQuoteClick}
          />
        </div>
      )}
    </div>
  );
}
