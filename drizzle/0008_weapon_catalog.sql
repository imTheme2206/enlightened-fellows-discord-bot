CREATE TABLE "weapon" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"rarity" integer NOT NULL,
	"raw" integer NOT NULL,
	"display" integer NOT NULL,
	"affinity" integer DEFAULT 0 NOT NULL,
	"specials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sharpness" jsonb,
	"handicraft" jsonb,
	"slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"elderseal" text,
	"defense_bonus" integer DEFAULT 0 NOT NULL,
	"series" text,
	"kind_specific" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "weapon_kind_name_unique" UNIQUE("kind","name")
);
--> statement-breakpoint
CREATE TABLE "weapon_skill" (
	"weapon_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"level" integer NOT NULL,
	CONSTRAINT "weapon_skill_weapon_id_skill_id_pk" PRIMARY KEY("weapon_id","skill_id")
);
--> statement-breakpoint
ALTER TABLE "weapon_skill" ADD CONSTRAINT "weapon_skill_weapon_id_weapon_id_fk" FOREIGN KEY ("weapon_id") REFERENCES "public"."weapon"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weapon_skill" ADD CONSTRAINT "weapon_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE cascade ON UPDATE no action;