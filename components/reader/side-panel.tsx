"use client";

import React from "react";
import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, FileText, PanelRightClose, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Notepad } from "./notepad";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface SidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: string;
  onClearContext: () => void;
  activeTab: "chat" | "notes";
  onTabChange: (tab: "chat" | "notes") => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  documentTitle?: string;
}

export function SidePanel({
  open,
  onOpenChange,
  context,
  onClearContext,
  activeTab,
  onTabChange,
  notes,
  onNotesChange,
  documentTitle,
}: SidePanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [width, setWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const minWidth = 320;
  const maxWidth = 600;

  // Handle resize drag
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.min(maxWidth, Math.max(minWidth, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

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

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);
    onClearContext();

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: generateMockResponse(userMessage.content),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen relative">
      {/* Toggle handle - always visible, positioned below header */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          "absolute left-0 top-1/2 -translate-x-full -translate-y-1/2",
          "flex items-center justify-center",
          "w-6 h-12 rounded-l-lg",
          "bg-white dark:bg-background border border-r-0 border-border",
          "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          "transition-colors cursor-pointer",
          "z-20"
        )}
        aria-label={open ? "Close panel" : "Open panel"}
      >
        {open ? (
          <PanelRightClose className="h-4 w-4" />
        ) : (
          <PanelRight className="h-4 w-4" />
        )}
      </button>

      {/* Panel content */}
      <div
        ref={panelRef}
        className={cn(
          "h-screen flex flex-col bg-white dark:bg-background border-l border-border relative",
          "overflow-hidden",
          !isResizing && "transition-all duration-300 ease-out"
        )}
        style={{ width: open ? width : 0, opacity: open ? 1 : 0 }}
      >
        {/* Resize handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={() => setIsResizing(true)}
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10",
            "hover:bg-accent/50 transition-colors",
            isResizing && "bg-accent"
          )}
        />

      <div className={cn(
        "flex flex-col h-full",
        !isResizing && "transition-transform duration-300 ease-out",
        open ? "translate-x-0" : "translate-x-full"
      )}
      style={{ minWidth: width }}
      >
        {/* Header with tabs */}
        <div className="px-4 h-14 flex items-center border-b border-border shrink-0">
          <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as "chat" | "notes")} className="w-full">
            <TabsList className="w-full bg-secondary">
              <TabsTrigger value="chat" className="flex-1 gap-2 data-[state=active]:bg-card">
                <Sparkles className="h-4 w-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex-1 gap-2 data-[state=active]:bg-card">
                <FileText className="h-4 w-4" />
                Notes
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        {activeTab === "chat" ? (
          <>
            {/* Messages area */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-start justify-center px-6 py-12">
                  <h3 className="text-2xl font-semibold text-foreground mb-2">
                    Hey there!
                  </h3>
                  <p className="text-xl text-muted-foreground">
                    {documentTitle
                      ? `I see you are reading ${documentTitle}, what can I help you with?`
                      : 'What can I help you with?'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                          message.role === "user"
                            ? "bg-accent text-accent-foreground"
                            : "bg-secondary text-secondary-foreground"
                        )}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-secondary rounded-2xl px-4 py-3">
                        <div className="flex gap-1">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
                          <span className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse [animation-delay:150ms]" />
                          <span className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input area */}
            <div className="p-4 border-t border-border shrink-0">
              {context && (
                <div className="mb-3 inline-flex items-center gap-1.5 px-2 py-1 bg-neutral-700 dark:bg-neutral-300 rounded-md">
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
                  className="flex-1 resize-none bg-neutral-50 dark:bg-neutral-900 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[100px] max-h-[200px] scrollbar-none"
                  rows={3}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="h-10 w-10 rounded-xl bg-neutral-800 text-neutral-100 hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-800 dark:hover:bg-neutral-300 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Notepad content={notes} onContentChange={onNotesChange} />
        )}
      </div>
      </div>
    </div>
  );
}

function generateMockResponse(question: string): string {
  const responses = [
    "This passage reflects Woolf's belief in the deeply personal nature of reading. She argues that reading should be an act of freedom, unconstrained by external authorities or prescribed methods. The reader must trust their own judgment and form their own interpretations.",
    "Woolf uses the metaphor of the library as a 'sanctuary' to emphasize that reading is one of the few areas of life where we can be truly free from social conventions. This freedom, however, requires discipline and focus to be meaningful.",
    "The phrase 'battle of Waterloo' versus the comparison of Shakespeare's plays illustrates Woolf's point about objective facts versus subjective value judgments. Historical events can be verified, but artistic merit is ultimately personal.",
    "Woolf's warning against 'squandering our powers' suggests that effective reading requires intention and focus. We must choose what to read carefully and engage deeply, rather than skim superficially across many texts.",
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}
