/**
 * PDF.js Polyfills Initialization
 *
 * This file sets up required polyfills BEFORE pdfjs-dist is imported.
 * pdfjs-dist checks for DOMMatrix during module initialization, so we must
 * set it up synchronously before any pdfjs-dist imports.
 */

// Import DOMMatrix polyfill
import DOMMatrixPolyfill from '@thednp/dommatrix';

// Set up DOMMatrix polyfill for Node.js environment
if (typeof globalThis.DOMMatrix === 'undefined') {
  // Handle both default export and named export cases
  const DOMMatrix = DOMMatrixPolyfill.default || DOMMatrixPolyfill;

  // @ts-ignore - DOMMatrix is not in Node.js types, but we're polyfilling it
  globalThis.DOMMatrix = DOMMatrix;

  // Also set it on global for compatibility (some code might check global.DOMMatrix)
  if (typeof global !== 'undefined') {
    // @ts-ignore
    global.DOMMatrix = DOMMatrix;
  }
}

// Export a function to verify the polyfill is set up
export function verifyPolyfills() {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    throw new Error('DOMMatrix polyfill failed to initialize');
  }
}

