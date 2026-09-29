CREATE TABLE "articles" (
	"id" serial PRIMARY KEY,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'Unknown' NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"url" text NOT NULL UNIQUE,
	"category" text DEFAULT 'Business' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"summary" text,
	"takeaways" jsonb,
	"terms" jsonb,
	"why_it_matters" text,
	"saved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
