-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNSUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: add new columns to couriers
ALTER TABLE "couriers"
  ADD COLUMN "passport_photo_url"    TEXT,
  ADD COLUMN "inn_photo_url"         TEXT,
  ADD COLUMN "verification_status"   "VerificationStatus" NOT NULL DEFAULT 'UNSUBMITTED',
  ADD COLUMN "verification_comment"  TEXT;

-- CreateIndex
CREATE INDEX "couriers_verification_status_idx" ON "couriers"("verification_status");
