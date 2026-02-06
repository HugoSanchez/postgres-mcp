CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DocumentChunk" (
	"id" text NOT NULL,
	"fileId" uuid NOT NULL,
	"path" text NOT NULL,
	"mimeType" text NOT NULL,
	"page" integer,
	"tab" text,
	"text" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"md5" text,
	"modifiedTime" timestamp,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "DocumentChunk_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DocumentNote" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"documentType" varchar NOT NULL,
	"title" varchar(255),
	"content" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "DocumentNote_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_fileId_Document_id_fk" FOREIGN KEY ("fileId") REFERENCES "public"."Document"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentNote" ADD CONSTRAINT "DocumentNote_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentNote" ADD CONSTRAINT "DocumentNote_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_chunk_file_idx" ON "DocumentChunk" USING btree ("fileId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_note_user_document_idx" ON "DocumentNote" USING btree ("userId","documentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_note_user_idx" ON "DocumentNote" USING btree ("userId");
