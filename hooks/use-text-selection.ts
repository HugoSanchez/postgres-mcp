'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TextSelection {
  text: string;
  startOffset: number;
  endOffset: number;
  rect: DOMRect;
}

interface UseTextSelectionOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  onSelectionChange?: (selection: TextSelection | null) => void;
}

/**
 * Hook to detect and track text selection within a container element.
 * Returns the selected text, character offsets, and position for UI placement.
 */
export function useTextSelection({
  containerRef,
  onSelectionChange,
}: UseTextSelectionOptions) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const isSelectingRef = useRef(false);

  /**
   * Calculate character offset from the start of the container to a given node/offset.
   */
  const getCharacterOffset = useCallback(
    (container: HTMLElement, targetNode: Node, targetOffset: number): number => {
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
      );

      let offset = 0;
      let node = walker.nextNode();

      while (node) {
        if (node === targetNode) {
          return offset + targetOffset;
        }
        offset += node.textContent?.length || 0;
        node = walker.nextNode();
      }

      return offset;
    },
    []
  );

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    onSelectionChange?.(null);
  }, [onSelectionChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = () => {
      isSelectingRef.current = true;
    };

    const handleMouseUp = () => {
      if (!isSelectingRef.current) return;
      isSelectingRef.current = false;

      // Capture selection immediately (no setTimeout)
      const windowSelection = window.getSelection();
      if (!windowSelection || windowSelection.isCollapsed) {
        setSelection(null);
        onSelectionChange?.(null);
        return;
      }

      const range = windowSelection.getRangeAt(0);

      // Check if selection is within our container
      if (!container.contains(range.commonAncestorContainer)) {
        return;
      }

      const text = windowSelection.toString().trim();
      if (!text) {
        setSelection(null);
        onSelectionChange?.(null);
        return;
      }

      // Calculate character offsets
      const startOffset = getCharacterOffset(
        container,
        range.startContainer,
        range.startOffset
      );
      const endOffset = getCharacterOffset(
        container,
        range.endContainer,
        range.endOffset
      );

      // Get bounding rect for popover positioning
      const rect = range.getBoundingClientRect();

      const newSelection: TextSelection = {
        text,
        startOffset,
        endOffset,
        rect,
      };

      setSelection(newSelection);
      onSelectionChange?.(newSelection);
    };

    const handleSelectionChange = () => {
      // Handle keyboard-based selection
      if (isSelectingRef.current) return;

      const windowSelection = window.getSelection();
      if (!windowSelection || windowSelection.isCollapsed) {
        return;
      }

      const range = windowSelection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        return;
      }
    };

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [containerRef, getCharacterOffset, onSelectionChange]);

  return {
    selection,
    clearSelection,
  };
}
