'use client';

import { useState, useEffect, useRef } from 'react';
import { type Editor } from '@tiptap/react';
import {
  Highlighter,
  MessageSquare,
  Quote,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { annotationColors } from '@/lib/tiptap/annotation-mark';

export type AnnotationColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'orange';

interface SelectionToolbarProps {
  editor: Editor | null;
  onHighlight: (color: AnnotationColor) => void;
  onComment: () => void;
  onAddToNotes: () => void;
  onAskAI: () => void;
}

const colorOptions: AnnotationColor[] = ['yellow', 'green', 'blue', 'pink', 'purple', 'orange'];

/**
 * Floating toolbar that appears when text is selected
 */
export function SelectionToolbar({
  editor,
  onHighlight,
  onComment,
  onAddToNotes,
  onAskAI,
}: SelectionToolbarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showColors, setShowColors] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;

    const updateToolbar = () => {
      const { selection } = editor.state;
      const { empty } = selection;

      if (empty) {
        setIsVisible(false);
        setShowColors(false);
        return;
      }

      const { ranges } = selection;
      const from = Math.min(...ranges.map((r) => r.$from.pos));
      const to = Math.max(...ranges.map((r) => r.$to.pos));

      const view = editor.view;
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);

      const editorElement = view.dom;
      const editorRect = editorElement.getBoundingClientRect();

      const centerX = (start.left + end.right) / 2;
      const top = start.top - editorRect.top - 45;
      const left = centerX - editorRect.left;

      setPosition({ top, left });
      setIsVisible(true);
    };

    editor.on('selectionUpdate', updateToolbar);
    editor.on('blur', () => {
      setTimeout(() => {
        if (!toolbarRef.current?.contains(document.activeElement)) {
          setIsVisible(false);
          setShowColors(false);
        }
      }, 150);
    });

    return () => {
      editor.off('selectionUpdate', updateToolbar);
    };
  }, [editor]);

  if (!isVisible || !editor) return null;

  return (
    <div
      ref={toolbarRef}
      className={cn(
        'absolute z-50 rounded-lg overflow-hidden',
        'bg-popover border border-border shadow-lg',
        'animate-in fade-in-0 zoom-in-95 duration-150'
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Main actions */}
      <div className="flex items-center px-1 py-1 gap-0.5">
        <button
          type="button"
          onClick={() => setShowColors(!showColors)}
          className={cn(
            'p-1.5 rounded text-muted-foreground',
            'hover:text-foreground hover:bg-muted/50',
            'transition-colors',
            showColors && 'text-foreground bg-muted/50'
          )}
          title="Highlight"
        >
          <Highlighter className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            onComment();
            setIsVisible(false);
          }}
          className={cn(
            'p-1.5 rounded text-muted-foreground',
            'hover:text-foreground hover:bg-muted/50',
            'transition-colors'
          )}
          title="Add comment"
        >
          <MessageSquare className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            onAddToNotes();
            setIsVisible(false);
          }}
          className={cn(
            'p-1.5 rounded text-muted-foreground',
            'hover:text-foreground hover:bg-muted/50',
            'transition-colors'
          )}
          title="Add to notes"
        >
          <Quote className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            onAskAI();
            setIsVisible(false);
          }}
          className={cn(
            'p-1.5 rounded text-muted-foreground',
            'hover:text-foreground hover:bg-muted/50',
            'transition-colors'
          )}
          title="Ask AI"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      </div>

      {/* Color picker - inline expansion */}
      {showColors && (
        <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 border-t border-border/50 bg-muted/20">
          {colorOptions.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                'h-5 w-5 rounded-full',
                'ring-1 ring-black/10',
                'hover:scale-110 hover:ring-2 hover:ring-black/20',
                'transition-transform'
              )}
              style={{ backgroundColor: annotationColors[color] }}
              onClick={() => {
                onHighlight(color);
                setShowColors(false);
                setIsVisible(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
