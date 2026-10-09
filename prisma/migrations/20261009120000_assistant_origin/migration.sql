-- AlterTable: mark work created by the planning assistant so a later run can replace it.
-- IF NOT EXISTS: this may first be applied by hand in the Supabase SQL editor.
ALTER TABLE "ManualTask" ADD COLUMN IF NOT EXISTS "fromAssistant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlannedBlock" ADD COLUMN IF NOT EXISTS "fromAssistant" BOOLEAN NOT NULL DEFAULT false;
