import type {
  document,
  documentOutline,
  documentPage,
} from './schema';

export type DocumentRow = typeof document.$inferSelect;
export type InsertDocument = typeof document.$inferInsert;

export type DocumentPageRow = typeof documentPage.$inferSelect;
export type InsertDocumentPage = typeof documentPage.$inferInsert;

export type DocumentOutlineRow = typeof documentOutline.$inferSelect;
export type InsertDocumentOutline = typeof documentOutline.$inferInsert;

