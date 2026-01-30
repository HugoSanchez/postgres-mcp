'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Sparkles, StickyNote } from 'lucide-react';
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
  onClose: () => void;
  isLoading?: boolean;
}

export function SelectionPopover({
  position,
  onSelectColor,
  onAskAI,
  onAddToNotes,
  onClose,
  isLoading = false,
}: SelectionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

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
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClickOutside, handleKeyDown]);

  if (!position) return null;

  return (
    <div
      ref={popoverRef}
      data-popover
      className={cn(
        'fixed z-50 flex items-center gap-1.5 p-1.5 rounded-lg',
        'bg-popover border border-border shadow-xl',
        'animate-in fade-in-0 zoom-in-95 duration-150'
      )}
      style={{
        left: position.x,
        top: position.y - 10,
        transform: 'translate(-50%, -100%)',
      }}
    >
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
    </div>
  );
}
