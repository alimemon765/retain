-- AlterTable
ALTER TABLE "PlannedBlock" ADD COLUMN     "taskIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
