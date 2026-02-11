import { Mark, mergeAttributes, type RawCommands } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface AnnotationMarkAttributes {
  id: string;
  color: string;
  type?: 'highlight' | 'comment' | 'ai-response' | 'quote';
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    annotationMark: {
      /**
       * Set an annotation mark
       */
      setAnnotation: (attributes: AnnotationMarkAttributes) => ReturnType;
      /**
       * Toggle an annotation mark
       */
      toggleAnnotation: (attributes: AnnotationMarkAttributes) => ReturnType;
      /**
       * Remove an annotation mark by ID
       */
      removeAnnotation: (id: string) => ReturnType;
    };
  }
}

// Color map for annotation colors
export const annotationColors: Record<string, string> = {
  yellow: 'rgba(255, 237, 74, 0.4)',
  green: 'rgba(74, 222, 128, 0.4)',
  blue: 'rgba(96, 165, 250, 0.4)',
  pink: 'rgba(249, 168, 212, 0.4)',
  purple: 'rgba(192, 132, 252, 0.4)',
  orange: 'rgba(251, 146, 60, 0.4)',
};

/**
 * TipTap Mark extension for annotations
 *
 * This mark is used to represent all annotation types (highlight, comment, ai-response, quote).
 * The actual annotation data is stored in the database, keyed by the mark's `id` attribute.
 * Multiple annotation marks can overlap on the same text.
 */
export const AnnotationMark = Mark.create<{
  HTMLAttributes: Record<string, unknown>;
}>({
  name: 'annotation',

  // Allow multiple annotation marks on the same text
  inclusive: false,
  excludes: '',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-annotation-id'),
        renderHTML: (attributes: Record<string, string | null>) => ({
          'data-annotation-id': attributes.id,
        }),
      },
      color: {
        default: 'yellow',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-annotation-color'),
        renderHTML: (attributes: Record<string, string | null>) => ({
          'data-annotation-color': attributes.color,
        }),
      },
      type: {
        default: 'highlight',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-annotation-type'),
        renderHTML: (attributes: Record<string, string | null>) => ({
          'data-annotation-type': attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'mark[data-annotation-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    // Try both prefixed and unprefixed keys (TipTap behavior varies)
    const color = (HTMLAttributes['data-annotation-color'] as string)
      || (HTMLAttributes.color as string)
      || 'yellow';
    const type = (HTMLAttributes['data-annotation-type'] as string)
      || (HTMLAttributes.type as string)
      || 'highlight';
    const backgroundColor = annotationColors[color] || annotationColors.yellow;

    // Determine style based on type
    const isAiResponse = type === 'ai-response';
    const isQuote = type === 'quote';
    const isComment = type === 'comment';

    // Add extra class for special types
    const classes = ['annotation-mark'];
    if (isAiResponse) {
      classes.push('annotation-ai-response');
    }
    if (isQuote) {
      classes.push('annotation-quote');
    }
    if (isComment) {
      classes.push('annotation-comment');
    }

    // AI responses: green dotted underline
    // Quotes and comments: gray dotted underline
    // Highlights: background color
    let style: string;
    if (isAiResponse) {
      style = 'background: transparent; text-decoration: underline; text-decoration-style: dotted; text-decoration-color: rgba(22, 163, 74, 0.7); text-underline-offset: 3px; text-decoration-thickness: 1.5px; cursor: pointer;';
    } else if (isQuote || isComment) {
      style = 'background: transparent; text-decoration: underline; text-decoration-style: dotted; text-decoration-color: rgba(156, 163, 175, 0.7); text-underline-offset: 3px; text-decoration-thickness: 1.5px; cursor: pointer;';
    } else {
      style = `background-color: ${backgroundColor}; padding: 0 2px; border-radius: 2px; cursor: pointer;`;
    }

    return [
      'mark',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: classes.join(' '),
        style,
      }),
      0,
    ];
  },

  addCommands(): Partial<RawCommands> {
    return {
      setAnnotation:
        (attributes: AnnotationMarkAttributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      toggleAnnotation:
        (attributes: AnnotationMarkAttributes) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes);
        },
      removeAnnotation:
        (id: string) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false;

          const { doc } = state;
          const markType = state.schema.marks[this.name];

          // Find all positions with this annotation mark
          const positions: { from: number; to: number }[] = [];
          doc.descendants((node: ProseMirrorNode, pos: number) => {
            if (node.isText) {
              const marks = node.marks.filter(
                (mark) => mark.type === markType && mark.attrs.id === id
              );
              if (marks.length > 0) {
                positions.push({ from: pos, to: pos + node.nodeSize });
              }
            }
          });

          // Remove the mark from all positions
          for (const { from, to } of positions) {
            tr.removeMark(from, to, markType);
          }

          return true;
        },
    };
  },
});

export default AnnotationMark;
