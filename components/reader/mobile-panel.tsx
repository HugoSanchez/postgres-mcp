"use client";

import React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Sparkles, FileText, Pin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Notepad } from "./notepad";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";
import type { EpubHighlightAnchor } from "@/lib/db/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Track Q&A pairs that can be saved as annotations
interface SaveableQA {
  question: string;
  answer: string;
  anchor: EpubHighlightAnchor;
  selectedText: string;
}

interface SeedMessages {
  question: string;
  answer: string;
}

interface MobilePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: string;
  contextAnchor: EpubHighlightAnchor | null;
  onClearContext: () => void;
  activeTab: "chat" | "notes";
  onTabChange: (tab: "chat" | "notes") => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  documentId: string;
  documentTitle?: string;
  onAnnotationCreated?: (chapterIndex: number) => void;
  seedMessages?: SeedMessages | null;
  onSeedMessagesConsumed?: () => void;
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
  documentTitle,
  onAnnotationCreated,
  seedMessages,
  onSeedMessagesConsumed,
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

  // Seed chat with messages from annotation click
  useEffect(() => {
    if (seedMessages) {
      const timestamp = Date.now();
      setMessages([
        { id: `${timestamp}-q`, role: "user", content: seedMessages.question },
        { id: `${timestamp}-a`, role: "assistant", content: seedMessages.answer },
      ]);
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

      // After response complete, store saveable Q&A if we have anchor data
      if (currentAnchor && currentContext && accumulatedContent) {
        saveableQAsRef.current.set(assistantMessageId, {
          question: questionText,
          answer: accumulatedContent,
          anchor: currentAnchor,
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
      const response = await fetch('/api/reader/annotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          documentType: 'epub',
          anchor: qa.anchor,
          selectedText: qa.selectedText,
          type: 'qa',
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

      // Notify parent to refresh annotations for this chapter
      onAnnotationCreated?.(qa.anchor.chapterIndex);
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
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <Tabs
            value={activeTab}
            onValueChange={(v) => onTabChange(v as "chat" | "notes")}
            className="flex-1"
          >
            <TabsList className="w-full bg-secondary">
              <TabsTrigger
                value="chat"
                className="flex-1 gap-2 data-[state=active]:bg-card"
              >
                <Sparkles className="h-4 w-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                className="flex-1 gap-2 data-[state=active]:bg-card"
              >
                <FileText className="h-4 w-4" />
                Notes
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="ml-2 h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {activeTab === "chat" ? (
        <>
          {/* Messages area */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-start justify-center px-6 py-8">
                <h3 className="font-semibold text-foreground mb-1 text-sm">
                  Hey there!
                </h3>
                <p className="text-xs text-muted-foreground">
                  {documentTitle
                    ? `I see you are reading ${documentTitle}, what can I help you with?`
                    : 'What can I help you with?'}
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
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                        message.role === "user"
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground prose prose-sm dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-ol:my-2"
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
          <div className="p-3 pb-6 border-t border-border shrink-0">
            {context && (
              <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-1 bg-neutral-800 dark:bg-neutral-200 rounded-md">
                <span className="text-xs text-neutral-300 dark:text-neutral-600">
                  Selection · {context.split(/\s+/).length} words
                </span>
                <button
                  type="button"
                  onClick={onClearContext}
                  className="text-neutral-400 hover:text-neutral-200 dark:text-neutral-500 dark:hover:text-neutral-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the text..."
                className="flex-1 resize-none bg-secondary rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent min-h-[56px] max-h-[100px] scrollbar-none"
                rows={2}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="h-10 w-10 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-hidden">
          <Notepad content={notes} onContentChange={onNotesChange} />
        </div>
      )}
    </div>
  );
}

