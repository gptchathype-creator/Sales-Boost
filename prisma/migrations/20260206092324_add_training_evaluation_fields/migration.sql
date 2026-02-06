-- AlterTable
ALTER TABLE "dialog_messages" ADD COLUMN "qualitySignalJson" TEXT;

-- AlterTable
ALTER TABLE "training_sessions" ADD COLUMN "evaluationJson" TEXT;
ALTER TABLE "training_sessions" ADD COLUMN "failureReason" TEXT;
ALTER TABLE "training_sessions" ADD COLUMN "totalScore" REAL;
