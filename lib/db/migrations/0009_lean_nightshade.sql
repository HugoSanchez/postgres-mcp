CREATE TABLE IF NOT EXISTS "EpubChapter" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"spineIndex" integer NOT NULL,
	"href" text NOT NULL,
	"title" text NOT NULL,
	"html" text NOT NULL,
	"text" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "EpubChapter_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "EpubChapter" ADD CONSTRAINT "EpubChapter_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "epub_chapter_doc_idx" ON "EpubChapter" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "epub_chapter_spine_idx" ON "EpubChapter" USING btree ("documentId","spineIndex");