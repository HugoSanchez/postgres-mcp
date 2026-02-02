'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Sparkles, StickyNote, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { HighlightColor } from '@/lib/db/types';

const HIGHLIGHT_COLORS: { color: HighlightColor; bg: string; ring: string }[] = [
  { color: 'yellow', bg: 'bg-yellow-300', ring: 'ring-yellow-400' },
  { color: 'green', bg: 'bg-green-300', ring: 'ring-green-400' },
  { color: 'blue', bg: 'bg-blue-300', ring: 'ring-blue-400' },
  { color: 'pink', bg: 'bg-pink-300', ring: 'ring-pink-400' },
  { color: 'purple', bg: 'bg-purple-300', ring: 'ring-purple-400' },
];

interface SelectionPopoverProps {
  position: { x: number; y: number } | null;
  onSelectColor: (color: HighlightColor) => void;
  onAskAI: () => void;
  onAddToNotes: () => void;
  onAddComment?: (text: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function SelectionPopover({
  position,
  onSelectColor,
  onAskAI,
  onAddToNotes,
  onAddComment,
  onClose,
  isLoading = false,
}: SelectionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<'default' | 'comment'>('default');
  const [commentText, setCommentText] = useState('');

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (mode === 'comment') {
          setMode('default');
          setCommentText('');
        } else {
          onClose();
        }
      }
    },
    [onClose, mode]
  );

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClickOutside, handleKeyDown]);

  // Focus textarea when entering comment mode
  useEffect(() => {
    if (mode === 'comment' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mode]);

  // Reset mode when position changes (new selection)
  useEffect(() => {
    setMode('default');
    setCommentText('');
  }, [position]);

  if (!position) return null;

  const handleSaveComment = () => {
    if (commentText.trim() && onAddComment) {
      onAddComment(commentText.trim());
      setMode('default');
      setCommentText('');
    }
  };

  const handleCancelComment = () => {
    setMode('default');
    setCommentText('');
  };

  return (
    <div
      ref={popoverRef}
      data-popover
      className={cn(
        'fixed z-50 rounded-lg',
        'bg-popover border border-border shadow-xl',
        'animate-in fade-in-0 zoom-in-95 duration-150'
      )}
      style={{
        left: position.x,
        top: position.y - 10,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {mode === 'default' ? (
        <div className="flex items-center gap-1.5 p-1.5">
          {/* Color circles for highlighting */}
          <div className="flex items-center gap-0.5">
            {HIGHLIGHT_COLORS.map(({ color, bg, ring }) => (
              <button
                key={color}
                type="button"
                disabled={isLoading}
                onClick={() => onSelectColor(color)}
                className={cn(
                  'size-4 rounded-full transition-all',
                  'hover:scale-110 hover:ring-2',
                  'focus:outline-none focus:ring-2',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  bg,
                  ring
                )}
                aria-label={`Highlight ${color}`}
              />
            ))}
          </div>

          <div className="w-px h-4 bg-border/60 mx-1" />

          {/* Ask AI button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onAskAI}
            disabled={isLoading}
            className="h-8 px-3 gap-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <Sparkles className="h-4 w-4" />
            Ask AI
          </Button>

          <div className="w-px h-4 bg-border/60 mx-1" />

          {/* Add to Notes button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddToNotes}
            disabled={isLoading}
            className="h-8 px-3 gap-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <StickyNote className="h-4 w-4" />
            Note
          </Button>

          {onAddComment && (
            <>
              <div className="w-px h-4 bg-border/60 mx-1" />

              {/* Comment button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode('comment')}
                disabled={isLoading}
                className="h-8 px-3 gap-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                <MessageCircle className="h-4 w-4" />
                Comment
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="p-3 w-72">
          <textarea
            ref={textareaRef}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add your comment..."
            className={cn(
              'w-full min-h-[80px] p-2 text-sm rounded-md resize-none',
              'bg-muted/50 border-none',
              'focus:outline-none focus:ring-1 focus:ring-ring/50',
              'placeholder:text-muted-foreground'
            )}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSaveComment();
              }
            }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelComment}
              className="h-7 px-3 text-sm"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveComment}
              disabled={!commentText.trim()}
              className="h-7 px-3 text-sm"
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
