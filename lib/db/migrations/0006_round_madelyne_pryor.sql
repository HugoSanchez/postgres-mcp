CREATE TABLE IF NOT EXISTS "Annotation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"readingId" uuid NOT NULL,
	"page" integer NOT NULL,
	"startChar" integer NOT NULL,
	"endChar" integer NOT NULL,
	"type" varchar NOT NULL,
	"color" varchar(32),
	"content" text,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ChatReading" (
	"chatId" uuid NOT NULL,
	"readingId" uuid NOT NULL,
	CONSTRAINT "ChatReading_chatId_readingId_pk" PRIMARY KEY("chatId","readingId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ReadingPage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"readingId" uuid NOT NULL,
	"page" integer NOT NULL,
	"text" text,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ReadingSource" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"title" text NOT NULL,
	"blobUrl" text NOT NULL,
	"pageCount" integer NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_readingId_ReadingSource_id_fk" FOREIGN KEY ("readingId") REFERENCES "public"."ReadingSource"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ChatReading" ADD CONSTRAINT "ChatReading_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ChatReading" ADD CONSTRAINT "ChatReading_readingId_ReadingSource_id_fk" FOREIGN KEY ("readingId") REFERENCES "public"."ReadingSource"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ReadingPage" ADD CONSTRAINT "ReadingPage_readingId_ReadingSource_id_fk" FOREIGN KEY ("readingId") REFERENCES "public"."ReadingSource"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ReadingSource" ADD CONSTRAINT "ReadingSource_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
