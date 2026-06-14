CREATE TABLE "armor" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"rank" text DEFAULT 'HIGH' NOT NULL,
	"rarity" integer DEFAULT 0 NOT NULL,
	"defense" integer DEFAULT 0 NOT NULL,
	"fire_res" integer DEFAULT 0 NOT NULL,
	"water_res" integer DEFAULT 0 NOT NULL,
	"thunder_res" integer DEFAULT 0 NOT NULL,
	"ice_res" integer DEFAULT 0 NOT NULL,
	"dragon_res" integer DEFAULT 0 NOT NULL,
	"slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "armor_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "armor_group_skill" (
	"armor_id" text NOT NULL,
	"skill_id" text NOT NULL,
	CONSTRAINT "armor_group_skill_armor_id_skill_id_pk" PRIMARY KEY("armor_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "armor_set_skill" (
	"armor_id" text NOT NULL,
	"skill_id" text NOT NULL,
	CONSTRAINT "armor_set_skill_armor_id_skill_id_pk" PRIMARY KEY("armor_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "armor_skill" (
	"armor_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"level" integer NOT NULL,
	CONSTRAINT "armor_skill_armor_id_skill_id_pk" PRIMARY KEY("armor_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "decoration" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"slot_size" integer NOT NULL,
	"skill_id" text NOT NULL,
	"skill_level" integer NOT NULL,
	CONSTRAINT "decoration_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "genshin_code" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"rewards" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_expired" boolean DEFAULT false NOT NULL,
	"is_alerted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "genshin_code_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "job_log" (
	"id" text PRIMARY KEY NOT NULL,
	"job_name" text NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registered_channel" (
	"channel_id" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registered_channel_channel_id_type_pk" PRIMARY KEY("channel_id","type")
);
--> statement-breakpoint
CREATE TABLE "search_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"data" jsonb NOT NULL,
	"searched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"clean_name" text NOT NULL,
	"type" text DEFAULT 'armor' NOT NULL,
	"max_level" integer DEFAULT 1 NOT NULL,
	"is_set_skill" boolean DEFAULT false NOT NULL,
	"is_group_skill" boolean DEFAULT false NOT NULL,
	"required_pieces" integer,
	"effect_name" text,
	CONSTRAINT "skill_name_unique" UNIQUE("name"),
	CONSTRAINT "skill_clean_name_unique" UNIQUE("clean_name")
);
--> statement-breakpoint
ALTER TABLE "armor_group_skill" ADD CONSTRAINT "armor_group_skill_armor_id_armor_id_fk" FOREIGN KEY ("armor_id") REFERENCES "public"."armor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "armor_group_skill" ADD CONSTRAINT "armor_group_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "armor_set_skill" ADD CONSTRAINT "armor_set_skill_armor_id_armor_id_fk" FOREIGN KEY ("armor_id") REFERENCES "public"."armor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "armor_set_skill" ADD CONSTRAINT "armor_set_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "armor_skill" ADD CONSTRAINT "armor_skill_armor_id_armor_id_fk" FOREIGN KEY ("armor_id") REFERENCES "public"."armor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "armor_skill" ADD CONSTRAINT "armor_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decoration" ADD CONSTRAINT "decoration_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE cascade ON UPDATE no action;