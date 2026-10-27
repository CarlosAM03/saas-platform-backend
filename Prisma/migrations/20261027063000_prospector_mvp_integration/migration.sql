CREATE TYPE "ProspectingDispatchState" AS ENUM ('PENDING', 'ACCEPTED', 'UNCERTAIN', 'REJECTED');
ALTER TABLE "prospecting_jobs"
  ADD COLUMN "idempotency_key_hash" TEXT,
  ADD COLUMN "payload_hash" TEXT,
  ADD COLUMN "dispatch_state" "ProspectingDispatchState",
  ADD COLUMN "service_generation" TEXT,
  ADD COLUMN "last_sequence" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deadline_at" TIMESTAMP(3),
  ADD COLUMN "capacity_released_at" TIMESTAMP(3),
  ADD COLUMN "failure_code" TEXT,
  ADD COLUMN "results_expires_at" TIMESTAMP(3);
CREATE UNIQUE INDEX "prospecting_jobs_intention_key" ON "prospecting_jobs"("tenant_id", "requested_by", "idempotency_key_hash");
CREATE INDEX "prospecting_jobs_created_at_idx" ON "prospecting_jobs"("created_at");
CREATE INDEX "prospecting_jobs_deadline_at_idx" ON "prospecting_jobs"("deadline_at");
CREATE TABLE "prospecting_job_events" (
  "job_id" TEXT NOT NULL,
  "event_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "disposition" TEXT NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prospecting_job_events_pkey" PRIMARY KEY ("job_id", "event_id"),
  CONSTRAINT "prospecting_job_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "prospecting_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "prospecting_job_events_job_id_sequence_key" ON "prospecting_job_events"("job_id", "sequence");
CREATE TABLE "prospecting_job_snapshots" (
  "job_id" TEXT NOT NULL,
  "results" JSONB NOT NULL CHECK (jsonb_typeof("results") = 'array'),
  "bytes" INTEGER NOT NULL CHECK ("bytes" >= 0 AND "bytes" <= 1048576),
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "prospecting_job_snapshots_pkey" PRIMARY KEY ("job_id"),
  CONSTRAINT "prospecting_job_snapshots_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "prospecting_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "prospecting_job_snapshots_expires_at_idx" ON "prospecting_job_snapshots"("expires_at");
