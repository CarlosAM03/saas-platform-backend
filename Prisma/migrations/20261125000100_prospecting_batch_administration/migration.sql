-- CreateEnum
CREATE TYPE "BatchAdmissionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'UNCERTAIN', 'REJECTED');

-- CreateEnum
CREATE TYPE "BatchJobState" AS ENUM ('QUEUED', 'RUNNING', 'AWAITING_RESULTS', 'COMPLETED', 'FAILED', 'INTERRUPTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "BatchResultQuality" AS ENUM ('SUCCESS', 'SUCCESS_WITH_ISSUES', 'PARTIAL');

-- CreateEnum
CREATE TYPE "BatchResultAvailability" AS ENUM ('AVAILABLE', 'EXPIRED', 'PURGED', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "prospecting_batches" (
    "id" TEXT NOT NULL,
    "solution_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "request_key_hash" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "admission" "BatchAdmissionStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_status" INTEGER,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospecting_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospecting_batch_jobs" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "state" "BatchJobState",
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "quality" "BatchResultQuality",
    "availability" "BatchResultAvailability",
    "progress" JSONB,
    "snapshot_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "ack_at" TIMESTAMP(3),
    "error_code" TEXT,
    "observed_at" TIMESTAMP(3),

    CONSTRAINT "prospecting_batch_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospecting_batch_events" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "digest" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospecting_batch_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prospecting_batches_tenant_id_owner_id_created_at_idx" ON "prospecting_batches"("tenant_id", "owner_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "prospecting_batches_solution_id_tenant_id_owner_id_request__key" ON "prospecting_batches"("solution_id", "tenant_id", "owner_id", "request_key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "prospecting_batch_jobs_batch_id_position_key" ON "prospecting_batch_jobs"("batch_id", "position");

-- CreateIndex
CREATE INDEX "prospecting_batch_events_job_id_sequence_idx" ON "prospecting_batch_events"("job_id", "sequence");

-- AddForeignKey
ALTER TABLE "prospecting_batch_jobs" ADD CONSTRAINT "prospecting_batch_jobs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "prospecting_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospecting_batch_events" ADD CONSTRAINT "prospecting_batch_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "prospecting_batch_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
