'use client';

import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { HighlightColor } from '@/lib/db/types';

const HIGHLIGHT_COLORS: { color: HighlightColor; bg: string; ring: string }[] = [
  { color: 'yellow', bg: 'bg-yellow-300', ring: 'ring-yellow-400' },
  { color: 'green', bg: 'bg-green-300', ring: 'ring-green-400' },
  { color: 'blue', bg: 'bg-blue-300', ring: 'ring-blue-400' },
  { color: 'pink', bg: 'bg-pink-300', ring: 'ring-pink-400' },
  { color: 'purple', bg: 'bg-purple-300', ring: 'ring-purple-400' },
];

interface HighlightPopoverProps {
  position: { x: number; y: number };
  onSelectColor: (color: HighlightColor) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function HighlightPopover({
  position,
  onSelectColor,
  onClose,
  isLoading = false,
}: HighlightPopoverProps) {
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

  // Calculate position to keep popover in viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y - 48, // Position above the selection
    transform: 'translateX(-50%)',
    zIndex: 50,
  };

  return (
    <div
      ref={popoverRef}
      style={style}
      className={cn(
        'flex items-center gap-1 rounded-lg border bg-popover p-1.5 shadow-lg',
        'animate-in fade-in-0 zoom-in-95'
      )}
    >
      {HIGHLIGHT_COLORS.map(({ color, bg, ring }) => (
        <button
          key={color}
          type="button"
          disabled={isLoading}
          onClick={() => onSelectColor(color)}
          className={cn(
            'size-7 rounded-full transition-all',
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
  );
}
