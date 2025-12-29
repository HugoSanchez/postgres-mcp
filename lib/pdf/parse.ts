import DOMMatrix from '@thednp/dommatrix';
import {
  GlobalWorkerOptions,
  getDocument,
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ParsedPdf, ParsedPage, TextSpan } from './types';

if (typeof globalThis.DOMMatrix === 'undefined') {
  // @ts-ignore
  globalThis.DOMMatrix = DOMMatrix;
}

// Ensure pdfjs knows where to find the worker in the Next.js bundle.
// Using import.meta.url keeps the path stable in server builds.
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url,
).toString();

export async function parsePdf(data: ArrayBuffer | Uint8Array): Promise<ParsedPdf> {
  // Ensure a plain Uint8Array (Buffer subclasses can trip pdfjs)
  const uint8 =
    data instanceof Uint8Array
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);

  const loadingTask = getDocument({
    data: uint8,
    // Reduce reliance on browser-only APIs when running in Node.
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;

  const outline: ParsedPdf['outline'] = [];
  try {
    const rawOutline = await pdf.getOutline();
    if (rawOutline) {
      for (const item of rawOutline) {
        if (!item.dest) continue;
        try {
          const pageIndex = await pdf.getPageIndex(item.dest[0]);
          outline.push({ title: item.title ?? 'Untitled', pageIndex });
        } catch {
          // Ignore outline entries we cannot resolve.
        }
      }
    }
  } catch {
    // Outline is optional; ignore failures.
  }

  const pages: Array<ParsedPage> = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    const spans: Array<TextSpan> = textContent.items.map((item: any) => {
      // transform: [a, b, c, d, e, f]; font size approximated by a/b
      const [a, b, , , e, f] = item.transform;
      const width = item.width ?? Math.hypot(a, b);
      const height = item.height ?? Math.hypot(a, b);
      const fontSize = Math.hypot(a, b);

      return {
        str: item.str,
        x: e,
        y: f,
        width,
        height,
        fontSize,
      };
    });

    const text = textContent.items.map((item: any) => item.str).join(' ');

    pages.push({
      index: i - 1,
      text,
      spans,
    });
  }

  return {
    numPages: pdf.numPages,
    outline,
    pages,
  };
}

