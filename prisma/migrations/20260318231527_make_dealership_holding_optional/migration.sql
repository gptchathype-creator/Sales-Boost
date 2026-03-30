-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_dealerships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "holdingId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "city" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "dealerships_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "holdings" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_dealerships" ("address", "city", "code", "createdAt", "holdingId", "id", "isActive", "name", "updatedAt") SELECT "address", "city", "code", "createdAt", "holdingId", "id", "isActive", "name", "updatedAt" FROM "dealerships";
DROP TABLE "dealerships";
ALTER TABLE "new_dealerships" RENAME TO "dealerships";
CREATE UNIQUE INDEX "dealerships_code_key" ON "dealerships"("code");
CREATE INDEX "dealerships_holdingId_idx" ON "dealerships"("holdingId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
