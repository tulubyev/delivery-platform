-- Add phone verification fields to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "phone_verified"       BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "phone_otp"            TEXT,
  ADD COLUMN IF NOT EXISTS "phone_otp_expires_at" TIMESTAMPTZ;

-- Existing users (seed/admin) are considered already verified
UPDATE "users" SET "phone_verified" = true WHERE "phone_verified" = false;
