CREATE TABLE "monster" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"game_id" integer NOT NULL,
	"kind" text NOT NULL,
	"species" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"base_health" integer NOT NULL,
	"size" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monster_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "monster_part" (
	"id" text PRIMARY KEY NOT NULL,
	"monster_id" text NOT NULL,
	"upstream_id" integer NOT NULL,
	"position" integer NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"health" integer,
	"kinsect_essence" text,
	"multipliers" jsonb NOT NULL,
	CONSTRAINT "monster_part_monster_upstream_unique" UNIQUE("monster_id","upstream_id")
);
--> statement-breakpoint
CREATE TABLE "monster_weakness" (
	"monster_id" text NOT NULL,
	"position" integer NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"level" integer NOT NULL,
	"condition" text,
	CONSTRAINT "monster_weakness_monster_id_position_pk" PRIMARY KEY("monster_id","position")
);
--> statement-breakpoint
ALTER TABLE "monster_part" ADD CONSTRAINT "monster_part_monster_id_monster_id_fk" FOREIGN KEY ("monster_id") REFERENCES "public"."monster"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monster_weakness" ADD CONSTRAINT "monster_weakness_monster_id_monster_id_fk" FOREIGN KEY ("monster_id") REFERENCES "public"."monster"("id") ON DELETE cascade ON UPDATE no action;