CREATE TABLE "saved_build" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_shared" boolean DEFAULT false NOT NULL,
	"shared_at" timestamp with time zone,
	"revision" integer DEFAULT 1 NOT NULL,
	"idempotency_key" text NOT NULL,
	"idempotency_payload_hash" text NOT NULL,
	"composition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_build_user_idempotency_key" UNIQUE("user_id","idempotency_key")
);
--> statement-breakpoint
CREATE INDEX "saved_build_owner_idx" ON "saved_build" USING btree ("user_id","updated_at","id");--> statement-breakpoint
CREATE INDEX "saved_build_shared_idx" ON "saved_build" USING btree ("is_shared","shared_at","id");