-- CreateTable
CREATE TABLE "permission_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissionsJson" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdByAccountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "permission_templates_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account_permission_template_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_permission_template_assignments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "account_permission_template_assignments_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "permission_templates" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "permission_templates_createdByAccountId_idx" ON "permission_templates"("createdByAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "permission_templates_name_key" ON "permission_templates"("name");

-- CreateIndex
CREATE INDEX "account_permission_template_assignments_accountId_idx" ON "account_permission_template_assignments"("accountId");

-- CreateIndex
CREATE INDEX "account_permission_template_assignments_templateId_idx" ON "account_permission_template_assignments"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "account_permission_template_assignments_accountId_templateId_key" ON "account_permission_template_assignments"("accountId", "templateId");
