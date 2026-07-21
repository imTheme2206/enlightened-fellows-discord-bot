CREATE TABLE "armor_bonus" (
	"armor_id" text NOT NULL,
	"bonus_id" text NOT NULL,
	CONSTRAINT "armor_bonus_armor_id_bonus_id_pk" PRIMARY KEY("armor_id","bonus_id")
);
--> statement-breakpoint
CREATE TABLE "bonus" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"clean_name" text NOT NULL,
	"kind" text NOT NULL,
	"icon" text,
	CONSTRAINT "bonus_name_unique" UNIQUE("name"),
	CONSTRAINT "bonus_clean_name_unique" UNIQUE("clean_name")
);
--> statement-breakpoint
CREATE TABLE "bonus_threshold" (
	"bonus_id" text NOT NULL,
	"pieces_required" integer NOT NULL,
	"effect_name" text NOT NULL,
	"level" integer NOT NULL,
	CONSTRAINT "bonus_threshold_bonus_id_pieces_required_pk" PRIMARY KEY("bonus_id","pieces_required")
);
--> statement-breakpoint
CREATE TABLE "decoration_skill" (
	"decoration_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"level" integer NOT NULL,
	CONSTRAINT "decoration_skill_decoration_id_skill_id_pk" PRIMARY KEY("decoration_id","skill_id")
);
--> statement-breakpoint
ALTER TABLE "armor_group_skill" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "armor_set_skill" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "armor_group_skill" CASCADE;--> statement-breakpoint
DROP TABLE "armor_set_skill" CASCADE;--> statement-breakpoint
ALTER TABLE "decoration" DROP CONSTRAINT "decoration_skill_id_skill_id_fk";
--> statement-breakpoint
ALTER TABLE "armor_bonus" ADD CONSTRAINT "armor_bonus_armor_id_armor_id_fk" FOREIGN KEY ("armor_id") REFERENCES "public"."armor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "armor_bonus" ADD CONSTRAINT "armor_bonus_bonus_id_bonus_id_fk" FOREIGN KEY ("bonus_id") REFERENCES "public"."bonus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bonus_threshold" ADD CONSTRAINT "bonus_threshold_bonus_id_bonus_id_fk" FOREIGN KEY ("bonus_id") REFERENCES "public"."bonus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decoration_skill" ADD CONSTRAINT "decoration_skill_decoration_id_decoration_id_fk" FOREIGN KEY ("decoration_id") REFERENCES "public"."decoration"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decoration_skill" ADD CONSTRAINT "decoration_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decoration" DROP COLUMN "skill_id";--> statement-breakpoint
ALTER TABLE "decoration" DROP COLUMN "skill_level";--> statement-breakpoint
ALTER TABLE "skill" DROP COLUMN "is_set_skill";--> statement-breakpoint
ALTER TABLE "skill" DROP COLUMN "is_group_skill";--> statement-breakpoint
ALTER TABLE "skill" DROP COLUMN "required_pieces";--> statement-breakpoint
ALTER TABLE "skill" DROP COLUMN "effect_name";