-- CreateEnum
CREATE TYPE "CancelCategory" AS ENUM ('PATIENT', 'CLINIC');

-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "discontinuedJudgeMonths" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "ClinicTarget" ADD COLUMN     "pointsPerPatientMax" DOUBLE PRECISION,
ADD COLUMN     "pointsPerPatientMin" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "MonthlyRecall" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "notifiedCount" INTEGER NOT NULL DEFAULT 0,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "visitedCount" INTEGER NOT NULL DEFAULT 0,
    "rebookedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyRecall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyCancelDetail" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "category" "CancelCategory" NOT NULL DEFAULT 'PATIENT',
    "reasonCode" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "recoveredCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyCancelDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyDiscontinued" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "noNextAppointment" INTEGER NOT NULL DEFAULT 0,
    "afterCancel" INTEGER NOT NULL DEFAULT 0,
    "afterNoShow" INTEGER NOT NULL DEFAULT 0,
    "maintenanceOverdue" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyDiscontinued_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyRecall_clinicId_yearMonth_key" ON "MonthlyRecall"("clinicId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyCancelDetail_clinicId_yearMonth_category_reasonCode_key" ON "MonthlyCancelDetail"("clinicId", "yearMonth", "category", "reasonCode");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyDiscontinued_clinicId_yearMonth_key" ON "MonthlyDiscontinued"("clinicId", "yearMonth");

-- AddForeignKey
ALTER TABLE "MonthlyRecall" ADD CONSTRAINT "MonthlyRecall_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyCancelDetail" ADD CONSTRAINT "MonthlyCancelDetail_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyDiscontinued" ADD CONSTRAINT "MonthlyDiscontinued_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

