CREATE TABLE IF NOT EXISTS "Highlight" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"documentType" varchar NOT NULL,
	"userId" uuid NOT NULL,
	"anchor" jsonb NOT NULL,
	"selectedText" text NOT NULL,
	"color" varchar DEFAULT 'yellow' NOT NULL,
	"note" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Highlight_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "highlight_document_idx" ON "Highlight" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "highlight_user_idx" ON "Highlight" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "highlight_document_user_idx" ON "Highlight" USING btree ("documentId","userId");