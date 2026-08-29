-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('DENTIST', 'HYGIENIST', 'ASSISTANT', 'RECEPTION', 'TECHNICIAN');

-- AlterTable
ALTER TABLE "ClinicProfile" ADD COLUMN     "avgMaintenanceMinutes" INTEGER NOT NULL DEFAULT 45;

-- CreateTable
CREATE TABLE "StaffCostRate" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "monthlyCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffCostRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpansionSetting" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "baseUnitCount" INTEGER NOT NULL DEFAULT 3,
    "revenuePerUnitBase" DOUBLE PRECISION,
    "revenuePerUnitMarginal" DOUBLE PRECISION,
    "useSpecialExpense" BOOLEAN NOT NULL DEFAULT true,
    "insuranceRevenueCap" DOUBLE PRECISION NOT NULL DEFAULT 50000000,
    "totalRevenueCap" DOUBLE PRECISION NOT NULL DEFAULT 70000000,
    "unitInvestmentCost" DOUBLE PRECISION NOT NULL DEFAULT 3000000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpansionSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffCostRate_clinicId_role_key" ON "StaffCostRate"("clinicId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ExpansionSetting_clinicId_key" ON "ExpansionSetting"("clinicId");

-- AddForeignKey
ALTER TABLE "StaffCostRate" ADD CONSTRAINT "StaffCostRate_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpansionSetting" ADD CONSTRAINT "ExpansionSetting_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

