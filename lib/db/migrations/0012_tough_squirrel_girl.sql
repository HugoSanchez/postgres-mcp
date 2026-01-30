CREATE TABLE IF NOT EXISTS "Annotation" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"documentType" varchar NOT NULL,
	"userId" uuid NOT NULL,
	"anchor" jsonb NOT NULL,
	"selectedText" text NOT NULL,
	"type" varchar NOT NULL,
	"content" jsonb NOT NULL,
	"color" varchar DEFAULT 'orange' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Annotation_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "annotation_document_idx" ON "Annotation" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "annotation_user_idx" ON "Annotation" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "annotation_document_user_idx" ON "Annotation" USING btree ("documentId","userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "annotation_type_idx" ON "Annotation" USING btree ("type");