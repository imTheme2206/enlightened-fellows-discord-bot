-- Data-only migration. ADR-0011 split Set/Group Bonuses out of `skill` into
-- `bonus` / `bonus_threshold` / `armor_bonus`, but the pre-split rows were left
-- behind in `skill` with type 'set' or 'group'. They break
-- `GET /api/mh-wilds/skills`: its contract types `kind` as 'armor' | 'weapon'
-- (domains/mh-wilds-catalog/schema.ts), so Elysia 422s the whole response.
--
-- The `bonus` tables themselves are repopulated by the scraper, not here — this
-- migration only removes the stale rows that make the endpoint unservable.
--
-- Fail loudly rather than orphan a Custom Talisman: the scrape pre-check
-- (`assertCustomTalismanIntegrity`) requires every referenced skill id to still
-- resolve, and a cascade-deleted id would wedge every future scrape.
DO $$
DECLARE orphaned int;
BEGIN
  SELECT count(*) INTO orphaned
  FROM custom_talisman t
  CROSS JOIN LATERAL jsonb_array_elements(t.skills) AS s
  JOIN skill ON skill.id = s->>'skillId'
  WHERE skill.type IN ('set', 'group');

  IF orphaned > 0 THEN
    RAISE EXCEPTION
      'Refusing to delete stale set/group skills: % custom talisman skill reference(s) still point at them. Migrate those talismans first.',
      orphaned;
  END IF;
END $$;--> statement-breakpoint
-- `armor_skill` and `decoration_skill` are the only FKs onto `skill`, both
-- ON DELETE CASCADE, so any stale grants go with the rows.
DELETE FROM "skill" WHERE "type" IN ('set', 'group');
