-- CreateTable
CREATE TABLE "voice_call_sessions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "callId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "scenario" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "outcome" TEXT,
    "durationSec" INTEGER,
    "transcriptJson" TEXT,
    "evaluationJson" TEXT,
    "totalScore" REAL,
    "failureReason" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "voice_call_sessions_callId_key" ON "voice_call_sessions"("callId");
