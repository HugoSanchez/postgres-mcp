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
CREATE INDEX IF NOT EXISTS "document_note_user_document_idx" ON "DocumentNote" USING btree ("userId","documentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_note_user_idx" ON "DocumentNote" USING btree ("userId");
