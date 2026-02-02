'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { X, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AnnotationRow } from '@/lib/db/types';

interface CommentPopoverProps {
  annotation: AnnotationRow;
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
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const content = annotation.content as { text?: string };
  const commentText = content?.text || '';

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false);
          setEditText('');
        } else {
          onClose();
        }
      }
    },
    [onClose, isEditing]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditText(commentText);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || editText.trim() === commentText) {
      setIsEditing(false);
      setEditText('');
      return;
    }

    setIsLoading(true);
    try {
      await onEdit(annotation.id, editText.trim());
      setIsEditing(false);
      setEditText('');
    } catch (error) {
      console.error('Failed to update comment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText('');
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
        'fixed z-50 w-72 rounded-lg',
        'bg-popover border border-border shadow-xl',
        'animate-in fade-in-0 zoom-in-95 duration-150'
      )}
      style={{
        left: position.x,
        top: position.y - 10,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">Comment</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-3">
        {isEditing ? (
          <>
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              disabled={isLoading}
              className={cn(
                'w-full min-h-[80px] p-2 text-sm rounded-md resize-none',
                'bg-muted/50 border-none',
                'focus:outline-none focus:ring-1 focus:ring-ring/50',
                'disabled:opacity-50'
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSaveEdit();
                }
              }}
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isLoading}
                className="h-7 px-3 text-sm"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={isLoading || !editText.trim()}
                className="h-7 px-3 text-sm"
              >
                Save
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {commentText}
            </p>
            <div className="flex justify-end gap-1 mt-3 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartEdit}
                disabled={isLoading}
                className="h-7 w-7 p-0 hover:bg-accent"
                title="Edit comment"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isLoading}
                className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                title="Delete comment"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
