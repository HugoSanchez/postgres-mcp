import { generateJSON } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { AnnotationMark } from './annotation-mark';

// TipTap JSON types
export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

export interface TipTapDocument {
  type: 'doc';
  content: TipTapNode[];
}


// Block-level node types (for text extraction spacing)
const BLOCK_TYPES = new Set([
  'paragraph', 'heading', 'blockquote', 'codeBlock',
  'bulletList', 'orderedList', 'listItem', 'horizontalRule',
  'table', 'tableRow', 'tableCell', 'tableHeader',
]);

/**
 * Extract plain text from TipTap JSON
 */
export function extractTextFromTipTap(doc: TipTapDocument): string {
  const textParts: string[] = [];

  function walk(node: TipTapNode) {
    if (node.text) {
      textParts.push(node.text);
    }
    if (node.content) {
      for (const child of node.content) {
        walk(child);
      }
      // Add spacing after block elements
      if (BLOCK_TYPES.has(node.type)) {
        textParts.push(' ');
      }
    }
  }

  walk(doc as TipTapNode);
  return textParts.join('').replace(/\s+/g, ' ').trim();
}

/**
 * Get configured TipTap extensions for parsing
 * These extensions define what HTML elements are recognized
 */
export function getParserExtensions() {
  return [
    StarterKit,
    Underline,
    Link.configure({
      openOnClick: false,
    }),
    Image,
    Table.configure({
      resizable: false,
    }),
    TableRow,
    TableCell,
    TableHeader,
    Subscript,
    Superscript,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    AnnotationMark,
  ];
}

/**
 * Convert HTML to TipTap JSON
 *
 * @param html - HTML string to convert
 * @returns TipTap document JSON
 */
export function htmlToTipTapJson(html: string): TipTapDocument {
  // Wrap in a container if not already a full document
  const wrappedHtml = html.trim().startsWith('<')
    ? html
    : `<p>${html}</p>`;

  // Convert HTML to TipTap JSON
  return generateJSON(wrappedHtml, getParserExtensions()) as TipTapDocument;
}

/**
 * Convert HTML to TipTap JSON and extract text content
 *
 * @param html - HTML string to convert
 * @returns Object with TipTap JSON and plain text
 */
export function processHtmlForStorage(html: string): {
  content: TipTapDocument;
  textContent: string;
} {
  const content = htmlToTipTapJson(html);
  const textContent = extractTextFromTipTap(content);

  return { content, textContent };
}
