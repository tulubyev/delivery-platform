ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "kpp"             TEXT,
  ADD COLUMN IF NOT EXISTS "ogrn"            TEXT,
  ADD COLUMN IF NOT EXISTS "legal_address"   TEXT,
  ADD COLUMN IF NOT EXISTS "contract_date"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "bank_name"       TEXT,
  ADD COLUMN IF NOT EXISTS "bank_bik"        TEXT,
  ADD COLUMN IF NOT EXISTS "bank_account"    TEXT,
  ADD COLUMN IF NOT EXISTS "bank_cor_account" TEXT,
  ADD COLUMN IF NOT EXISTS "notes"           TEXT;
