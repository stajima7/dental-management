-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULLTIME', 'PARTTIME');

-- CreateTable
CREATE TABLE "Practitioner" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULLTIME',
    "isDirector" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Practitioner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyPractitionerStats" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "practitionerId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "insuranceRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "selfPayRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "workHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "patientCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyPractitionerStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Practitioner_clinicId_name_key" ON "Practitioner"("clinicId", "name");

-- CreateIndex
CREATE INDEX "MonthlyPractitionerStats_clinicId_yearMonth_idx" ON "MonthlyPractitionerStats"("clinicId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPractitionerStats_practitionerId_yearMonth_key" ON "MonthlyPractitionerStats"("practitionerId", "yearMonth");

-- AddForeignKey
ALTER TABLE "Practitioner" ADD CONSTRAINT "Practitioner_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyPractitionerStats" ADD CONSTRAINT "MonthlyPractitionerStats_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyPractitionerStats" ADD CONSTRAINT "MonthlyPractitionerStats_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "Practitioner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

