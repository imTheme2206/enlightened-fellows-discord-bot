CREATE TABLE "catalog_sync_state" (
	"source" text PRIMARY KEY NOT NULL,
	"content_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
