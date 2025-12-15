CREATE TABLE IF NOT EXISTS "DocumentOutline" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"title" text NOT NULL,
	"pageIndex" integer NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "DocumentOutline_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DocumentPage" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"pageIndex" integer NOT NULL,
	"text" text,
	"spans" jsonb,
	"hasOcr" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "DocumentPage_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
DROP TABLE "Annotation";--> statement-breakpoint
DROP TABLE "ChatReading";--> statement-breakpoint
DROP TABLE "ReadingPage";--> statement-breakpoint
DROP TABLE "ReadingSource";--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "originalFilename" text;--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "mimeType" text;--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "sizeBytes" integer;--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "blobUrl" text;--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "checksumSha256" text;--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "pageCount" integer;--> statement-breakpoint
-- Deduplicate Document table: keep only the most recent row per id
-- First, delete any Suggestion rows that reference duplicate Document rows (if Suggestion table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Suggestion') THEN
    DELETE FROM "Suggestion"
    WHERE ("documentId", "documentCreatedAt") IN (
      SELECT d."id", d."createdAt"
      FROM "Document" d
      WHERE d."id" IN (
        SELECT "id" FROM "Document" GROUP BY "id" HAVING COUNT(*) > 1
      )
      AND d."createdAt" NOT IN (
        SELECT MAX("createdAt") FROM "Document" GROUP BY "id"
      )
    );
  END IF;
END $$;
--> statement-breakpoint
-- Delete duplicate Document rows, keeping only the most recent per id
-- Only run if duplicates exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Document" GROUP BY "id" HAVING COUNT(*) > 1
  ) THEN
    DELETE FROM "Document" d1
    WHERE EXISTS (
      SELECT 1 FROM "Document" d2
      WHERE d2."id" = d1."id"
      AND d2."createdAt" > d1."createdAt"
    );
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_id_unique" ON "Document" USING btree ("id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentOutline" ADD CONSTRAINT "DocumentOutline_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentPage" ADD CONSTRAINT "DocumentPage_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_outline_doc_idx" ON "DocumentOutline" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_page_doc_idx" ON "DocumentPage" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_checksum_idx" ON "Document" USING btree ("checksumSha256");--> statement-breakpoint
ALTER TABLE "Document" DROP COLUMN IF EXISTS "content";--> statement-breakpoint
ALTER TABLE "Document" DROP COLUMN IF EXISTS "text";
