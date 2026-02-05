-- AlterTable
ALTER TABLE "attempts" ADD COLUMN "conversationHistoryJson" TEXT;
ALTER TABLE "attempts" ADD COLUMN "virtualCustomerStateJson" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "useVirtualCustomer" BOOLEAN NOT NULL DEFAULT false,
    "virtualCustomerConfigJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_tests" ("createdAt", "id", "isActive", "title") SELECT "createdAt", "id", "isActive", "title" FROM "tests";
DROP TABLE "tests";
ALTER TABLE "new_tests" RENAME TO "tests";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
