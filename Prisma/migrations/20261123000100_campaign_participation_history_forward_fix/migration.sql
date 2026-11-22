-- Forward fix for the campaign-participation migration.
-- Historical migrations are immutable; this migration only corrects effects
-- already applied by 20261122000100_campaign_participation_sprint.

BEGIN;

-- The prior migration generated these deterministic provenance rows from
-- legacy fields. Those fields do not prove a confirmed action, so legacy
-- prospects must remain without a provenance event until one is confirmed.
DELETE FROM "prospect_provenance" AS pp
USING "prospects" AS p
WHERE pp."id" = 'legacy_' || p."id"
  AND pp."prospect_id" = p."id"
  AND pp."tenant_id" = p."tenant_id"
  AND pp."campaign_id" IS NOT DISTINCT FROM p."campaign_id"
  AND pp."type" = 'CREATED'
  AND pp."source" = p."source"
  AND pp."actor_user_id" IS NULL
  AND pp."recorded_at" = p."created_at"
  AND pp."details" IS NULL;

-- Both relations retain append-only history. A physical deletion must be
-- rejected instead of silently removing activities or provenance evidence.
ALTER TABLE "campaign_activities"
  DROP CONSTRAINT "campaign_activities_participation_fkey",
  ADD CONSTRAINT "campaign_activities_participation_fkey"
  FOREIGN KEY ("campaign_id", "prospect_id")
  REFERENCES "campaign_prospects"("campaign_id", "prospect_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "prospect_provenance"
  DROP CONSTRAINT "prospect_provenance_prospect_fkey",
  ADD CONSTRAINT "prospect_provenance_prospect_fkey"
  FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
