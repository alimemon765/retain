-- CreateTable
CREATE TABLE "PlannerSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "wakeTime" TEXT NOT NULL DEFAULT '06:30',
    "sleepHours" DOUBLE PRECISION NOT NULL DEFAULT 7.5,
    "preBufferMinutes" INTEGER NOT NULL DEFAULT 60,
    "travelMinutes" INTEGER NOT NULL DEFAULT 60,
    "focusMode" TEXT NOT NULL DEFAULT 'BALANCED',
    "minBlockMinutes" INTEGER NOT NULL DEFAULT 25,
    "maxBlockMinutes" INTEGER NOT NULL DEFAULT 90,
    "breakMinutes" INTEGER NOT NULL DEFAULT 10,
    "bufferPercent" INTEGER NOT NULL DEFAULT 20,
    "mealBlocks" JSONB NOT NULL DEFAULT '[]',
    "gcalCalendarId" TEXT,
    "gcalRefreshToken" TEXT,
    "gcalSyncClasses" BOOLEAN NOT NULL DEFAULT true,
    "gcalLastSyncAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSlot" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "subjectId" TEXT,
    "location" TEXT,
    "weekParity" TEXT NOT NULL DEFAULT 'EVERY',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ClassSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarException" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,

    CONSTRAINT "CalendarException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedBlock" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topicIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "problemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bookId" TEXT,
    "skillId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "gcalEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannedBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "estimateMins" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 3,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassSlot_dayOfWeek_idx" ON "ClassSlot"("dayOfWeek");

-- CreateIndex
CREATE INDEX "CalendarException_date_idx" ON "CalendarException"("date");

-- CreateIndex
CREATE INDEX "PlannedBlock_date_idx" ON "PlannedBlock"("date");
