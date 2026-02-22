-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_training_sessions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "clientProfile" TEXT NOT NULL DEFAULT 'normal',
    "stateJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "assessmentScore" REAL,
    "assessmentJson" TEXT,
    "failureReason" TEXT,
    "evaluationJson" TEXT,
    "totalScore" REAL,
    CONSTRAINT "training_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_training_sessions" ("assessmentJson", "assessmentScore", "completedAt", "createdAt", "evaluationJson", "failureReason", "id", "stateJson", "status", "totalScore", "userId") SELECT "assessmentJson", "assessmentScore", "completedAt", "createdAt", "evaluationJson", "failureReason", "id", "stateJson", "status", "totalScore", "userId" FROM "training_sessions";
DROP TABLE "training_sessions";
ALTER TABLE "new_training_sessions" RENAME TO "training_sessions";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
