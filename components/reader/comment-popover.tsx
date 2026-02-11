'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Annotation, CommentContent } from '@/lib/db/schema';

interface CommentPopoverProps {
  annotation: Annotation;
  position: { x: number; y: number };
  onClose: () => void;
  onEdit: (id: string, newText: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function CommentPopover({
  annotation,
  position,
  onClose,
  onEdit,
  onDelete,
}: CommentPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const content = annotation.content as CommentContent | null;
  const initialComment = content?.comment || '';
  const [text, setText] = useState(initialComment);

  // Close on escape
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        // Save before closing if text changed
        if (text.trim() !== initialComment) {
          handleSave();
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, text, initialComment, onClose]);

  // Auto-focus textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, []);

  const handleSave = async () => {
    if (text.trim() === initialComment) {
      onClose();
      return;
    }

    setIsLoading(true);
    try {
      await onEdit(annotation.id, text.trim());
      onClose();
    } catch (error) {
      console.error('Failed to update comment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await onDelete(annotation.id);
      onClose();
    } catch (error) {
      console.error('Failed to delete comment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      ref={popoverRef}
      className={cn(
        'fixed z-50 w-64 rounded-lg overflow-hidden',
        'bg-popover border border-border shadow-lg',
        'animate-in fade-in-0 zoom-in-95 duration-150'
      )}
      style={{
        left: position.x,
        top: position.y - 8,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isLoading}
        placeholder="Add a note..."
        className={cn(
          'w-full min-h-[72px] p-3 text-sm resize-none',
          'bg-transparent border-none',
          'focus:outline-none',
          'placeholder:text-muted-foreground/60',
          'disabled:opacity-50'
        )}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSave();
          }
        }}
      />

      <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 bg-muted/30">
        <span className="text-xs text-muted-foreground">
          {isLoading ? 'Saving...' : '⌘↵'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || !text.trim()}
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded text-muted-foreground/60',
              'hover:text-primary hover:bg-primary/10',
              'transition-colors text-xs',
              'disabled:opacity-30 disabled:cursor-not-allowed'
            )}
            title="Save comment"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Save</span>
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isLoading}
            className={cn(
              'p-1 rounded text-muted-foreground/60',
              'hover:text-destructive hover:bg-destructive/10',
              'transition-colors',
              'disabled:opacity-50'
            )}
            title="Delete comment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
