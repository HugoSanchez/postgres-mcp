'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { useEffect, useCallback } from 'react';
import type { TipTapDocument } from '@/lib/tiptap/html-to-json';
import { AnnotationMark } from '@/lib/tiptap/annotation-mark';

interface TipTapRendererProps {
  content: TipTapDocument;
  className?: string;
  editable?: boolean;
  onEditorReady?: (editor: Editor) => void;
  onSelectionChange?: (hasSelection: boolean, selectedText: string) => void;
  onAnnotationClick?: (annotationId: string, position: { x: number; y: number }) => void;
}

/**
 * TipTap renderer with annotation support
 */
export function TipTapRenderer({
  content,
  className,
  editable = false,
  onEditorReady,
  onSelectionChange,
  onAnnotationClick,
}: TipTapRendererProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-blue-600 hover:underline cursor-pointer',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4',
        },
      }),
      Table.configure({
        resizable: false,
        HTMLAttributes: {
          class: 'border-collapse my-4',
        },
      }),
      TableRow,
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 dark:border-gray-600 px-3 py-2',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-100 dark:bg-gray-800 font-semibold',
        },
      }),
      Subscript,
      Superscript,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      AnnotationMark,
    ],
    content,
    editable,
    immediatelyRender: false, // Prevent SSR hydration mismatch
    editorProps: {
      attributes: {
        class: 'outline-none',
      },
      handleClick: (view, pos, event) => {
        // Handle clicks on annotation marks
        const target = event.target as HTMLElement;
        const annotationMark = target.closest('[data-annotation-id]');
        if (annotationMark && onAnnotationClick) {
          const annotationId = annotationMark.getAttribute('data-annotation-id');
          if (annotationId) {
            const rect = annotationMark.getBoundingClientRect();
            onAnnotationClick(annotationId, {
              x: rect.left + rect.width / 2,
              y: rect.top,
            });
            return true;
          }
        }
        return false;
      },
    },
    onSelectionUpdate: ({ editor }) => {
      if (onSelectionChange) {
        const { from, to, empty } = editor.state.selection;
        if (empty) {
          onSelectionChange(false, '');
        } else {
          const selectedText = editor.state.doc.textBetween(from, to, ' ');
          onSelectionChange(true, selectedText);
        }
      }
    },
  });

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Update content when it changes
  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  if (!editor) {
    return <div className="text-muted-foreground">Loading content...</div>;
  }

  return (
    <div className={className}>
      <EditorContent
        editor={editor}
        className="
          prose prose-neutral dark:prose-invert max-w-none
          prose-headings:font-semibold prose-headings:tracking-tight
          prose-h1:text-3xl prose-h1:mt-8 prose-h1:mb-4
          prose-h2:text-2xl prose-h2:mt-6 prose-h2:mb-3
          prose-h3:text-xl prose-h3:mt-5 prose-h3:mb-2
          prose-p:my-4 prose-p:text-lg prose-p:leading-7
          prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic
          prose-ul:my-4 prose-ol:my-4
          prose-li:my-1
          prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:rounded
          prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:p-4 prose-pre:rounded-lg
          prose-img:rounded-lg prose-img:my-4
        "
      />
    </div>
  );
}

// Re-export Editor type for convenience
export type { Editor };
