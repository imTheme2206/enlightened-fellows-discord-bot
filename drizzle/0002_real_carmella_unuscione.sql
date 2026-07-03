CREATE TABLE "custom_talisman" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"skills" jsonb NOT NULL,
	"slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_talisman_user_id_name_unique" UNIQUE("user_id","name")
);
