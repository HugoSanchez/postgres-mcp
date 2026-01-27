CREATE TABLE IF NOT EXISTS "ReadingProgress" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"documentType" varchar NOT NULL,
	"chapterIndex" integer,
	"scrollPosition" real DEFAULT 0 NOT NULL,
	"lastReadAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ReadingProgress_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reading_progress_user_document_idx" ON "ReadingProgress" USING btree ("userId","documentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reading_progress_user_idx" ON "ReadingProgress" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reading_progress_last_read_idx" ON "ReadingProgress" USING btree ("lastReadAt");