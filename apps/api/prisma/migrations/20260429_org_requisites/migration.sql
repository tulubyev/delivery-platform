ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "kpp"           TEXT,
  ADD COLUMN IF NOT EXISTS "ogrn"          TEXT,
  ADD COLUMN IF NOT EXISTS "legal_address" TEXT,
  ADD COLUMN IF NOT EXISTS "phone"         TEXT,
  ADD COLUMN IF NOT EXISTS "email"         TEXT,
  ADD COLUMN IF NOT EXISTS "website"       TEXT,
  ADD COLUMN IF NOT EXISTS "contract_no"   TEXT,
  ADD COLUMN IF NOT EXISTS "contract_date" TIMESTAMPTZ;
