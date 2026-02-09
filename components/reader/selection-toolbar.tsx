'use client';

import { useState, useEffect, useRef } from 'react';
import { type Editor } from '@tiptap/react';
import {
  Highlighter,
  MessageSquare,
  BookmarkPlus,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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

const colorOptions: { color: AnnotationColor; label: string }[] = [
  { color: 'yellow', label: 'Yellow' },
  { color: 'green', label: 'Green' },
  { color: 'blue', label: 'Blue' },
  { color: 'pink', label: 'Pink' },
  { color: 'purple', label: 'Purple' },
  { color: 'orange', label: 'Orange' },
];

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
  const [showColorPicker, setShowColorPicker] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;

    const updateToolbar = () => {
      const { selection } = editor.state;
      const { empty } = selection;

      if (empty) {
        setIsVisible(false);
        setShowColorPicker(false);
        return;
      }

      // Get the selection coordinates
      const { ranges } = selection;
      const from = Math.min(...ranges.map((r) => r.$from.pos));
      const to = Math.max(...ranges.map((r) => r.$to.pos));

      // Get DOM coordinates
      const view = editor.view;
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);

      // Position toolbar above the selection
      const editorElement = view.dom;
      const editorRect = editorElement.getBoundingClientRect();

      // Calculate center of selection
      const centerX = (start.left + end.right) / 2;
      const top = start.top - editorRect.top - 50; // 50px above selection
      const left = centerX - editorRect.left;

      setPosition({ top, left });
      setIsVisible(true);
    };

    // Update on selection change
    editor.on('selectionUpdate', updateToolbar);
    editor.on('blur', () => {
      // Delay hiding to allow button clicks
      setTimeout(() => {
        if (!toolbarRef.current?.contains(document.activeElement)) {
          setIsVisible(false);
          setShowColorPicker(false);
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
        'absolute z-50 flex items-center gap-1 rounded-lg border bg-background p-1 shadow-lg',
        'animate-in fade-in-0 zoom-in-95 duration-150'
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Highlight with color picker */}
      <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Highlight"
          >
            <Highlighter className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="center">
          <div className="flex gap-1">
            {colorOptions.map(({ color, label }) => (
              <button
                key={color}
                className="h-6 w-6 rounded-full border-2 border-transparent hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ backgroundColor: annotationColors[color] }}
                title={label}
                onClick={() => {
                  onHighlight(color);
                  setShowColorPicker(false);
                  setIsVisible(false);
                }}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Comment */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        title="Add comment"
        onClick={() => {
          onComment();
          setIsVisible(false);
        }}
      >
        <MessageSquare className="h-4 w-4" />
      </Button>

      {/* Add to Notes */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        title="Add to notes"
        onClick={() => {
          onAddToNotes();
          setIsVisible(false);
        }}
      >
        <BookmarkPlus className="h-4 w-4" />
      </Button>

      {/* Ask AI */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        title="Ask AI"
        onClick={() => {
          onAskAI();
          setIsVisible(false);
        }}
      >
        <Sparkles className="h-4 w-4" />
      </Button>
    </div>
  );
}
