"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { schema, defaultMarkdownParser, defaultMarkdownSerializer } from "prosemirror-markdown";
import { inputRules, wrappingInputRule, textblockTypeInputRule, InputRule } from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";

interface MarkdownEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  placeholder?: string;
}

// Input rules for markdown-style typing
function buildInputRules() {
  const rules: InputRule[] = [];

  // # Heading
  rules.push(textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({
    level: match[1].length,
  })));

  // > Blockquote
  rules.push(wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote));

  // - or * for bullet list
  rules.push(wrappingInputRule(/^\s*([-*])\s$/, schema.nodes.bullet_list));

  // 1. for ordered list
  rules.push(wrappingInputRule(/^\s*(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({
    order: Number(match[1]),
  }), (match, node) => node.childCount + (node.attrs.order as number) === Number(match[1])));

  // ``` for code block
  rules.push(textblockTypeInputRule(/^```$/, schema.nodes.code_block));

  // **bold** or __bold__
  rules.push(new InputRule(/(\*\*|__)([^*_]+)\1$/, (state, match, start, end) => {
    const text = match[2];
    const boldMark = schema.marks.strong.create();
    return state.tr.replaceWith(start, end, schema.text(text, [boldMark]));
  }));

  // *italic* or _italic_
  rules.push(new InputRule(/(?<!\*|_)(\*|_)([^*_]+)\1(?!\*|_)$/, (state, match, start, end) => {
    const text = match[2];
    const italicMark = schema.marks.em.create();
    return state.tr.replaceWith(start, end, schema.text(text, [italicMark]));
  }));

  // `code`
  rules.push(new InputRule(/`([^`]+)`$/, (state, match, start, end) => {
    const text = match[1];
    const codeMark = schema.marks.code.create();
    return state.tr.replaceWith(start, end, schema.text(text, [codeMark]));
  }));

  // --- or *** for horizontal rule
  rules.push(new InputRule(/^(---|\*\*\*)$/, (state, _match, start, end) => {
    return state.tr.replaceWith(start, end, schema.nodes.horizontal_rule.create());
  }));

  return inputRules({ rules });
}

export function MarkdownEditor({ content, onContentChange, placeholder = "Start writing..." }: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isExternalUpdate = useRef(false);

  // Serialize editor content to markdown
  const serializeToMarkdown = useCallback((state: EditorState): string => {
    return defaultMarkdownSerializer.serialize(state.doc);
  }, []);

  // Parse markdown to editor document
  const parseFromMarkdown = useCallback((markdown: string) => {
    return defaultMarkdownParser.parse(markdown) || schema.topNodeType.createAndFill()!;
  }, []);

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;

    const doc = parseFromMarkdown(content);

    const state = EditorState.create({
      doc,
      plugins: [
        buildInputRules(),
        keymap({
          "Mod-z": undo,
          "Mod-Shift-z": redo,
          "Mod-y": redo,
          "Mod-b": toggleMark(schema.marks.strong),
          "Mod-i": toggleMark(schema.marks.em),
          "Mod-`": toggleMark(schema.marks.code),
        }),
        keymap(baseKeymap),
        history(),
      ],
    });

    const view = new EditorView(editorRef.current, {
      state,
      dispatchTransaction(transaction) {
        const newState = view.state.apply(transaction);
        view.updateState(newState);

        if (transaction.docChanged && !isExternalUpdate.current) {
          const markdown = serializeToMarkdown(newState);
          onContentChange(markdown);
        }
      },
      attributes: {
        class: "prose-editor",
        "data-placeholder": placeholder,
      },
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Update editor when content prop changes externally
  useEffect(() => {
    if (!viewRef.current) return;

    const currentMarkdown = serializeToMarkdown(viewRef.current.state);
    if (currentMarkdown !== content) {
      isExternalUpdate.current = true;
      const doc = parseFromMarkdown(content);
      const state = EditorState.create({
        doc,
        plugins: viewRef.current.state.plugins,
      });
      viewRef.current.updateState(state);
      isExternalUpdate.current = false;
    }
  }, [content, parseFromMarkdown, serializeToMarkdown]);

  return (
    <div className="markdown-editor-wrapper h-full">
      <div ref={editorRef} className="h-full" />
      <style jsx global>{`
        .markdown-editor-wrapper {
          height: 100%;
        }

        .prose-editor {
          height: 100%;
          padding: 1rem;
          outline: none;
          font-size: 0.875rem;
          line-height: 1.625;
        }

        .prose-editor:focus {
          outline: none;
        }

        /* Placeholder */
        .prose-editor:empty::before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          position: absolute;
        }

        /* Headings */
        .prose-editor h1 {
          font-size: 1.875rem;
          font-weight: 700;
          margin: 1rem 0 0.5rem;
          line-height: 1.2;
        }

        .prose-editor h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 1rem 0 0.5rem;
          line-height: 1.3;
        }

        .prose-editor h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0.75rem 0 0.5rem;
          line-height: 1.4;
        }

        .prose-editor h4, .prose-editor h5, .prose-editor h6 {
          font-size: 1rem;
          font-weight: 600;
          margin: 0.75rem 0 0.5rem;
        }

        /* Paragraphs */
        .prose-editor p {
          margin: 0.5rem 0;
        }

        /* Bold */
        .prose-editor strong {
          font-weight: 600;
        }

        /* Italic */
        .prose-editor em {
          font-style: italic;
        }

        /* Code inline */
        .prose-editor code {
          background: hsl(var(--secondary));
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-family: ui-monospace, monospace;
          font-size: 0.8125rem;
        }

        /* Code block */
        .prose-editor pre {
          background: hsl(var(--secondary));
          padding: 0.75rem 1rem;
          border-radius: 0.375rem;
          overflow-x: auto;
          margin: 0.75rem 0;
        }

        .prose-editor pre code {
          background: none;
          padding: 0;
          font-size: 0.8125rem;
        }

        /* Blockquote */
        .prose-editor blockquote {
          border-left: 3px solid hsl(var(--border));
          padding-left: 1rem;
          margin: 0.75rem 0;
          color: hsl(var(--muted-foreground));
        }

        /* Lists */
        .prose-editor ul, .prose-editor ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }

        .prose-editor ul {
          list-style-type: disc;
        }

        .prose-editor ol {
          list-style-type: decimal;
        }

        .prose-editor li {
          margin: 0.25rem 0;
        }

        /* Horizontal rule */
        .prose-editor hr {
          border: none;
          border-top: 1px solid hsl(var(--border));
          margin: 1rem 0;
        }

        /* Links */
        .prose-editor a {
          color: hsl(var(--primary));
          text-decoration: underline;
        }

        /* Selection */
        .prose-editor ::selection {
          background: hsl(var(--primary) / 0.3);
        }

        /* ProseMirror specific */
        .ProseMirror {
          height: 100%;
          outline: none;
        }

        .ProseMirror:focus {
          outline: none;
        }

        .ProseMirror > *:first-child {
          margin-top: 0;
        }
      `}</style>
    </div>
  );
}
