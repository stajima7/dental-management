-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "clinicName" TEXT NOT NULL,
    "corporateName" TEXT,
    "prefecture" TEXT,
    "city" TEXT,
    "address" TEXT,
    "openingYear" INTEGER,
    "corporateType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "clinicType" TEXT NOT NULL DEFAULT '[]',
    "isHomeVisit" BOOLEAN NOT NULL DEFAULT false,
    "isSetupComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Clinic_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    CONSTRAINT "ClinicUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClinicUser_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "targetYearMonth" TEXT,
    "unitCount" INTEGER NOT NULL DEFAULT 0,
    "activeUnitCount" INTEGER NOT NULL DEFAULT 0,
    "fulltimeDentistCount" INTEGER NOT NULL DEFAULT 0,
    "parttimeDentistCount" INTEGER NOT NULL DEFAULT 0,
    "fulltimeHygienistCount" INTEGER NOT NULL DEFAULT 0,
    "parttimeHygienistCount" INTEGER NOT NULL DEFAULT 0,
    "fulltimeAssistantCount" INTEGER NOT NULL DEFAULT 0,
    "parttimeAssistantCount" INTEGER NOT NULL DEFAULT 0,
    "fulltimeReceptionCount" INTEGER NOT NULL DEFAULT 0,
    "parttimeReceptionCount" INTEGER NOT NULL DEFAULT 0,
    "fulltimeTechnicianCount" INTEGER NOT NULL DEFAULT 0,
    "parttimeTechnicianCount" INTEGER NOT NULL DEFAULT 0,
    "hasOfficeManager" BOOLEAN NOT NULL DEFAULT false,
    "hasCt" BOOLEAN NOT NULL DEFAULT false,
    "hasMicroscope" BOOLEAN NOT NULL DEFAULT false,
    "hasCadcam" BOOLEAN NOT NULL DEFAULT false,
    "hasOperationRoom" BOOLEAN NOT NULL DEFAULT false,
    "clinicDaysPerMonth" INTEGER NOT NULL DEFAULT 22,
    "avgHoursPerDay" REAL NOT NULL DEFAULT 8,
    "avgOvertimeHours" REAL NOT NULL DEFAULT 0,
    "workHours" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClinicProfile_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "yearMonth" TEXT,
    "monthlyRevenue" REAL,
    "selfPayRatio" REAL,
    "newPatients" INTEGER,
    "returnRate" REAL,
    "laborCostRatio" REAL,
    "maintenanceTransitionRate" REAL,
    "operatingProfitRate" REAL,
    "revenuePerUnit" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClinicTarget_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UploadFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorLog" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadFile_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mappingJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportMapping_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlyRevenue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "departmentType" TEXT NOT NULL,
    "revenueType" TEXT NOT NULL DEFAULT 'TREATMENT',
    "insuranceOrPrivate" TEXT NOT NULL DEFAULT 'INSURANCE',
    "amount" REAL NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "patientCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyRevenue_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlyPatients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "departmentType" TEXT NOT NULL DEFAULT 'TOTAL',
    "totalPatientCount" INTEGER NOT NULL DEFAULT 0,
    "uniquePatientCount" INTEGER NOT NULL DEFAULT 0,
    "newPatientCount" INTEGER NOT NULL DEFAULT 0,
    "returnPatientCount" INTEGER NOT NULL DEFAULT 0,
    "dropoutCount" INTEGER NOT NULL DEFAULT 0,
    "maintenanceTransitionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyPatients_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlyAppointments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "departmentType" TEXT NOT NULL DEFAULT 'TOTAL',
    "appointmentCount" INTEGER NOT NULL DEFAULT 0,
    "cancelCount" INTEGER NOT NULL DEFAULT 0,
    "noShowCount" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyAppointments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlyCosts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "costItemCode" TEXT NOT NULL,
    "departmentType" TEXT NOT NULL DEFAULT 'TOTAL',
    "isDirectCost" BOOLEAN NOT NULL DEFAULT false,
    "isDirectAssigned" BOOLEAN NOT NULL DEFAULT false,
    "amount" REAL NOT NULL DEFAULT 0,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyCosts_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlyKpis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "kpiCode" TEXT NOT NULL,
    "kpiValue" REAL NOT NULL DEFAULT 0,
    "comparisonPrevMonth" REAL,
    "comparisonPrevYear" REAL,
    "targetValue" REAL,
    "achievementRate" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyKpis_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AllocationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "costItemCode" TEXT NOT NULL,
    "allocationTargetType" TEXT NOT NULL,
    "driverType" TEXT NOT NULL,
    "driverRatio" REAL NOT NULL DEFAULT 0,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TEXT,
    "effectiveTo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AllocationRule_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AllocationDriverValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "driverType" TEXT NOT NULL,
    "departmentType" TEXT NOT NULL,
    "driverValue" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AllocationDriverValue_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AllocationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "costItemCode" TEXT NOT NULL,
    "departmentType" TEXT NOT NULL,
    "driverType" TEXT NOT NULL,
    "driverRate" REAL NOT NULL DEFAULT 0,
    "allocatedAmount" REAL NOT NULL DEFAULT 0,
    "manualAdjustmentAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AllocationResult_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DepartmentProfitability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "departmentType" TEXT NOT NULL,
    "revenue" REAL NOT NULL DEFAULT 0,
    "directCost" REAL NOT NULL DEFAULT 0,
    "directAssignedCost" REAL NOT NULL DEFAULT 0,
    "grossProfit" REAL NOT NULL DEFAULT 0,
    "preAllocationProfit" REAL NOT NULL DEFAULT 0,
    "allocatedIndirectCost" REAL NOT NULL DEFAULT 0,
    "postAllocationOperatingProfit" REAL NOT NULL DEFAULT 0,
    "grossMargin" REAL NOT NULL DEFAULT 0,
    "operatingMargin" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DepartmentProfitability_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cause" TEXT,
    "suggestion" TEXT NOT NULL,
    "expectedImpact" TEXT,
    "impact" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiInsight_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "insightId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "dueDate" DATETIME,
    "assignee" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActionPlan_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicUser_userId_clinicId_key" ON "ClinicUser"("userId", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicProfile_clinicId_targetYearMonth_key" ON "ClinicProfile"("clinicId", "targetYearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicTarget_clinicId_yearMonth_key" ON "ClinicTarget"("clinicId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyRevenue_clinicId_yearMonth_departmentType_revenueType_insuranceOrPrivate_key" ON "MonthlyRevenue"("clinicId", "yearMonth", "departmentType", "revenueType", "insuranceOrPrivate");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPatients_clinicId_yearMonth_departmentType_key" ON "MonthlyPatients"("clinicId", "yearMonth", "departmentType");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyAppointments_clinicId_yearMonth_departmentType_key" ON "MonthlyAppointments"("clinicId", "yearMonth", "departmentType");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyCosts_clinicId_yearMonth_costItemCode_departmentType_key" ON "MonthlyCosts"("clinicId", "yearMonth", "costItemCode", "departmentType");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyKpis_clinicId_yearMonth_kpiCode_key" ON "MonthlyKpis"("clinicId", "yearMonth", "kpiCode");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationRule_clinicId_costItemCode_allocationTargetType_key" ON "AllocationRule"("clinicId", "costItemCode", "allocationTargetType");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationDriverValue_clinicId_yearMonth_driverType_departmentType_key" ON "AllocationDriverValue"("clinicId", "yearMonth", "driverType", "departmentType");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationResult_clinicId_yearMonth_costItemCode_departmentType_key" ON "AllocationResult"("clinicId", "yearMonth", "costItemCode", "departmentType");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentProfitability_clinicId_yearMonth_departmentType_key" ON "DepartmentProfitability"("clinicId", "yearMonth", "departmentType");
