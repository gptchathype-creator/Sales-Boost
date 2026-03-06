-- Add deterministic link from call batch job to call audit/session representation.
ALTER TABLE "call_batch_jobs" ADD COLUMN "linkedAuditId" TEXT;
ALTER TABLE "call_batch_jobs" ADD COLUMN "linkReason" TEXT;
