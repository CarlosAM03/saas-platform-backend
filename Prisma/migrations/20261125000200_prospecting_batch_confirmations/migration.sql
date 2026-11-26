-- CreateTable
CREATE TABLE "prospecting_batch_confirmations" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "decision_hash" TEXT NOT NULL,
    "processed_count" INTEGER NOT NULL,
    "omitted_count" INTEGER NOT NULL,
    "committed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ack_at" TIMESTAMP(3),
    "purged_at" TIMESTAMP(3),

    CONSTRAINT "prospecting_batch_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prospecting_batch_confirmations_job_id_snapshot_id_key" ON "prospecting_batch_confirmations"("job_id", "snapshot_id");

-- AddForeignKey
ALTER TABLE "prospecting_batch_confirmations" ADD CONSTRAINT "prospecting_batch_confirmations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "prospecting_batch_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
