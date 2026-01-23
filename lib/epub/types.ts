/**
 * EPUB parsing types
 */

export interface EpubChapter {
  /** Index in the EPUB spine (reading order) */
  spineIndex: number;
  /** Internal HREF reference to the chapter file */
  href: string;
  /** Chapter title from TOC or extracted from content */
  title: string;
  /** Raw HTML content of the chapter */
  html: string;
  /** Plain text content extracted from HTML */
  text: string;
}

export interface EpubTocItem {
  /** Unique identifier for the TOC item */
  id: string;
  /** Display title */
  title: string;
  /** HREF reference to the content */
  href: string;
  /** Nested TOC items (for hierarchical navigation) */
  children: EpubTocItem[];
}

export interface EpubMetadata {
  /** Book title */
  title: string;
  /** Author(s) */
  creator?: string;
  /** Publisher */
  publisher?: string;
  /** Language code (e.g., "en") */
  language?: string;
  /** ISBN or other identifier */
  identifier?: string;
  /** Publication date */
  date?: string;
  /** Book description/summary */
  description?: string;
  /** Cover image URL (if extracted) */
  coverUrl?: string;
}

export interface ParsedEpub {
  /** Book metadata */
  metadata: EpubMetadata;
  /** Ordered list of chapters (spine order) */
  chapters: EpubChapter[];
  /** Table of contents structure */
  toc: EpubTocItem[];
  /** Total number of chapters */
  chapterCount: number;
  /** Images extracted from the EPUB */
  images: EpubImage[];
  /** OPF directory path (e.g., "OEBPS/") */
  opfDir: string;
}

export interface EpubOutlineItem {
  /** Display title */
  title: string;
  /** Spine index this outline item points to */
  spineIndex: number;
  /** Order for sorting */
  order: number;
}

export interface EpubImage {
  /** Path within the EPUB (relative to OPF directory) */
  path: string;
  /** Full path within the EPUB archive */
  fullPath: string;
  /** Image data as Buffer */
  data: Buffer;
  /** MIME type (e.g., "image/jpeg", "image/png") */
  mediaType: string;
}
