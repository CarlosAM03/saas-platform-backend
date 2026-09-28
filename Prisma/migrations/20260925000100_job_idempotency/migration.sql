CREATE TABLE "prospecting_job_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prospecting_job_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "prospecting_job_requests_job_id_key" ON "prospecting_job_requests"("job_id");
CREATE UNIQUE INDEX "prospecting_job_requests_tenant_id_user_id_key_hash_key" ON "prospecting_job_requests"("tenant_id", "user_id", "key_hash");
ALTER TABLE "prospecting_job_requests" ADD CONSTRAINT "prospecting_job_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prospecting_job_requests" ADD CONSTRAINT "prospecting_job_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prospecting_job_requests" ADD CONSTRAINT "prospecting_job_requests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "prospecting_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
