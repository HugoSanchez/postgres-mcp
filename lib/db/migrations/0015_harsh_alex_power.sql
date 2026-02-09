CREATE TABLE IF NOT EXISTS "DocumentSection" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"index" integer NOT NULL,
	"title" text,
	"content" jsonb NOT NULL,
	"textContent" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "DocumentSection_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "DocumentSection" ADD CONSTRAINT "DocumentSection_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_section_doc_idx" ON "DocumentSection" USING btree ("documentId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_section_doc_index_idx" ON "DocumentSection" USING btree ("documentId","index");