CREATE TABLE "custom_weapon" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"weapon_id" text NOT NULL,
	"customization" jsonb NOT NULL,
	"set_bonus_id" text,
	"group_bonus_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_weapon_user_name_unique" UNIQUE("user_id","name")
);
