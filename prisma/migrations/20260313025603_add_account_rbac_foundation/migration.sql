-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "emailVerifiedAt" DATETIME,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "dealerships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "holdingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "city" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "dealerships_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "holdings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "manager_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealershipId" TEXT NOT NULL,
    "accountId" TEXT,
    "telegramUserId" INTEGER,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "manager_profiles_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "dealerships" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "manager_profiles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "manager_profiles_telegramUserId_fkey" FOREIGN KEY ("telegramUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account_memberships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "holdingId" TEXT,
    "dealershipId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_memberships_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "account_memberships_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "holdings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "account_memberships_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "dealerships" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "telegram_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME,
    CONSTRAINT "telegram_links_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "telegram_link_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'link_telegram',
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_link_codes_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telegramId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'manager',
    "preferencesJson" TEXT,
    "accountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("createdAt", "fullName", "id", "preferencesJson", "role", "telegramId") SELECT "createdAt", "fullName", "id", "preferencesJson", "role", "telegramId" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_telegramId_key" ON "users"("telegramId");
CREATE INDEX "users_accountId_idx" ON "users"("accountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "holdings_code_key" ON "holdings"("code");

-- CreateIndex
CREATE UNIQUE INDEX "dealerships_code_key" ON "dealerships"("code");

-- CreateIndex
CREATE INDEX "dealerships_holdingId_idx" ON "dealerships"("holdingId");

-- CreateIndex
CREATE UNIQUE INDEX "manager_profiles_telegramUserId_key" ON "manager_profiles"("telegramUserId");

-- CreateIndex
CREATE INDEX "manager_profiles_dealershipId_idx" ON "manager_profiles"("dealershipId");

-- CreateIndex
CREATE INDEX "manager_profiles_accountId_idx" ON "manager_profiles"("accountId");

-- CreateIndex
CREATE INDEX "account_memberships_accountId_role_idx" ON "account_memberships"("accountId", "role");

-- CreateIndex
CREATE INDEX "account_memberships_holdingId_role_idx" ON "account_memberships"("holdingId", "role");

-- CreateIndex
CREATE INDEX "account_memberships_dealershipId_role_idx" ON "account_memberships"("dealershipId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "account_memberships_accountId_role_holdingId_dealershipId_key" ON "account_memberships"("accountId", "role", "holdingId", "dealershipId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_links_telegramId_key" ON "telegram_links"("telegramId");

-- CreateIndex
CREATE INDEX "telegram_links_accountId_idx" ON "telegram_links"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_link_codes_code_key" ON "telegram_link_codes"("code");

-- CreateIndex
CREATE INDEX "telegram_link_codes_accountId_purpose_idx" ON "telegram_link_codes"("accountId", "purpose");

-- CreateIndex
CREATE INDEX "telegram_link_codes_expiresAt_idx" ON "telegram_link_codes"("expiresAt");
