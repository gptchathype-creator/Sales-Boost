-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_dialog_messages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'text',
    "voiceFileId" TEXT,
    "voiceDurationSec" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dialog_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "training_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_dialog_messages" ("content", "createdAt", "id", "role", "sessionId") SELECT "content", "createdAt", "id", "role", "sessionId" FROM "dialog_messages";
DROP TABLE "dialog_messages";
ALTER TABLE "new_dialog_messages" RENAME TO "dialog_messages";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
