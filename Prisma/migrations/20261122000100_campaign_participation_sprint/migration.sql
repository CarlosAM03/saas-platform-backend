CREATE TYPE "CommercialStage" AS ENUM (
  'SIN_GESTIONAR',
  'EN_INVESTIGACION',
  'CONTACTADO',
  'EN_SEGUIMIENTO',
  'OPORTUNIDAD',
  'CERRADO'
);

CREATE TYPE "CommercialEvaluation" AS ENUM (
  'SIN_EVALUAR',
  'APTO',
  'NO_APTO'
);

CREATE TYPE "CampaignActivityType" AS ENUM (
  'NOTE',
  'CALL',
  'EMAIL',
  'MEETING',
  'OTHER',
  'ASSOCIATION',
  'STAGE_CHANGE',
  'EVALUATION_CHANGE',
  'RESPONSIBLE_CHANGE',
  'CORRECTION',
  'MASTER_UPDATE'
);

CREATE TYPE "ProspectProvenanceType" AS ENUM (
  'CREATED',
  'LINKED',
  'REAPPEARED',
  'MASTER_UPDATED'
);

ALTER TABLE "prospects"
  ADD COLUMN "identity_source" TEXT,
  ADD COLUMN "identity_hash" TEXT;

CREATE UNIQUE INDEX "prospects_tenant_id_identity_source_identity_hash_key"
  ON "prospects"("tenant_id", "identity_source", "identity_hash");
CREATE INDEX "prospects_tenant_id_name_idx" ON "prospects"("tenant_id", "name");

ALTER TABLE "campaign_prospects"
  ADD COLUMN "commercial_stage" "CommercialStage" NOT NULL DEFAULT 'SIN_GESTIONAR',
  ADD COLUMN "evaluation" "CommercialEvaluation" NOT NULL DEFAULT 'SIN_EVALUAR',
  ADD COLUMN "evaluation_reason" TEXT,
  ADD COLUMN "responsible_id" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "campaign_prospects"
  ADD CONSTRAINT "campaign_prospects_responsible_id_fkey"
  FOREIGN KEY ("responsible_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "campaign_prospects_campaign_id_commercial_stage_idx"
  ON "campaign_prospects"("campaign_id", "commercial_stage");
CREATE INDEX "campaign_prospects_campaign_id_evaluation_idx"
  ON "campaign_prospects"("campaign_id", "evaluation");
CREATE INDEX "campaign_prospects_campaign_id_responsible_id_idx"
  ON "campaign_prospects"("campaign_id", "responsible_id");

-- Recreate origin links only when campaign and prospect share a tenant.
INSERT INTO "campaign_prospects" (
  "campaign_id",
  "prospect_id",
  "status",
  "commercial_stage",
  "evaluation",
  "evaluation_reason",
  "responsible_id",
  "updated_at",
  "added_at"
)
SELECT
  p."campaign_id",
  p."id",
  'ACTIVO',
  'SIN_GESTIONAR',
  'SIN_EVALUAR',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  p."created_at"
FROM "prospects" p
JOIN "campaigns" c
  ON c."id" = p."campaign_id"
 AND c."tenant_id" = p."tenant_id"
WHERE NOT EXISTS (
  SELECT 1
  FROM "campaign_prospects" cp
  WHERE cp."campaign_id" = p."campaign_id"
    AND cp."prospect_id" = p."id"
)
ON CONFLICT ("campaign_id", "prospect_id") DO NOTHING;

CREATE TABLE "campaign_activities" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "prospect_id" TEXT NOT NULL,
  "type" "CampaignActivityType" NOT NULL,
  "content" TEXT,
  "declared_at" TIMESTAMP(3),
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor_user_id" TEXT,
  "previous_value" TEXT,
  "new_value" TEXT,
  "reason" TEXT,
  "corrects_id" TEXT,

  CONSTRAINT "campaign_activities_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "campaign_activities"
  ADD CONSTRAINT "campaign_activities_participation_fkey"
  FOREIGN KEY ("campaign_id", "prospect_id")
  REFERENCES "campaign_prospects"("campaign_id", "prospect_id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "campaign_activities_actor_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "campaign_activities_correction_fkey"
  FOREIGN KEY ("corrects_id") REFERENCES "campaign_activities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "campaign_activities_tenant_campaign_prospect_recorded_idx"
  ON "campaign_activities"("tenant_id", "campaign_id", "prospect_id", "recorded_at");
CREATE INDEX "campaign_activities_campaign_recorded_idx"
  ON "campaign_activities"("campaign_id", "recorded_at");

CREATE TABLE "prospect_provenance" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "prospect_id" TEXT NOT NULL,
  "campaign_id" TEXT,
  "type" "ProspectProvenanceType" NOT NULL,
  "source" TEXT NOT NULL,
  "actor_user_id" TEXT,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "details" JSONB,

  CONSTRAINT "prospect_provenance_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "prospect_provenance"
  ADD CONSTRAINT "prospect_provenance_prospect_fkey"
  FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "prospect_provenance_actor_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "prospect_provenance_tenant_prospect_recorded_idx"
  ON "prospect_provenance"("tenant_id", "prospect_id", "recorded_at");

-- Persist only the origin facts already present in legacy prospect records.
INSERT INTO "prospect_provenance" (
  "id", "tenant_id", "prospect_id", "campaign_id", "type", "source",
  "actor_user_id", "recorded_at", "details"
)
SELECT
  'legacy_' || p."id",
  p."tenant_id",
  p."id",
  p."campaign_id",
  'CREATED',
  p."source",
  NULL,
  p."created_at",
  NULL
FROM "prospects" p
WHERE NOT EXISTS (
  SELECT 1
  FROM "prospect_provenance" pp
  WHERE pp."id" = 'legacy_' || p."id"
);
