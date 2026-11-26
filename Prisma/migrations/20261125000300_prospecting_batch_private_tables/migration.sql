-- Batch data is available through the backend database role, not Supabase Data API roles.
ALTER TABLE "prospecting_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prospecting_batch_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prospecting_batch_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prospecting_batch_confirmations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  "prospecting_batches", "prospecting_batch_jobs", "prospecting_batch_events",
  "prospecting_batch_confirmations"
FROM PUBLIC;

DO $$
DECLARE
  api_role text;
BEGIN
  FOR api_role IN SELECT rolname FROM pg_roles
    WHERE rolname IN ('anon', 'authenticated', 'service_role')
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE prospecting_batches, prospecting_batch_jobs, prospecting_batch_events, prospecting_batch_confirmations FROM %I',
      api_role
    );
  END LOOP;
END
$$;
