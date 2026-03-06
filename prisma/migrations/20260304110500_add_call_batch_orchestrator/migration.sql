-- CreateTable
CREATE TABLE "call_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'running',
    "title" TEXT,
    "maxConcurrency" INTEGER NOT NULL DEFAULT 10,
    "startIntervalMs" INTEGER NOT NULL DEFAULT 250,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "totalJobs" INTEGER NOT NULL DEFAULT 0,
    "queuedJobs" INTEGER NOT NULL DEFAULT 0,
    "inProgressJobs" INTEGER NOT NULL DEFAULT 0,
    "completedJobs" INTEGER NOT NULL DEFAULT 0,
    "failedJobs" INTEGER NOT NULL DEFAULT 0,
    "cancelledJobs" INTEGER NOT NULL DEFAULT 0,
    "retryingJobs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "call_batch_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "dealershipId" TEXT,
    "dealershipName" TEXT,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "queuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextRunAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "lastError" TEXT,
    "lastOutcome" TEXT,
    "lastVoiceCallId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "call_batch_jobs_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "call_batches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "call_batch_attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "voiceCallId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'dialing',
    "outcome" TEXT,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "call_batch_attempts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "call_batch_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "call_batch_jobs_batchId_status_nextRunAt_idx" ON "call_batch_jobs"("batchId", "status", "nextRunAt");

-- CreateIndex
CREATE INDEX "call_batch_attempts_jobId_attempt_idx" ON "call_batch_attempts"("jobId", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "call_batch_attempts_voiceCallId_key" ON "call_batch_attempts"("voiceCallId");
