-- Weapons are re-ingested by the next scrape (nothing references them yet); existing rows have no game_id.
DELETE FROM "weapon";--> statement-breakpoint
ALTER TABLE "weapon" DROP CONSTRAINT "weapon_kind_name_unique";--> statement-breakpoint
ALTER TABLE "weapon" ADD COLUMN "game_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "weapon" ADD CONSTRAINT "weapon_kind_game_id_unique" UNIQUE("kind","game_id");