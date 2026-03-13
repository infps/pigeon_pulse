-- CreateEnum (conditional — already exists from init migration)
DO $$ BEGIN
  CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PROSPECT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('BREEDER', 'ADMIN', 'SUPERADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey (legacy tables — may not exist on shadow DB)
ALTER TABLE IF EXISTS "BirdsView" DROP CONSTRAINT IF EXISTS "BirdsView_LOST_ID_RACE_fkey";
ALTER TABLE IF EXISTS "Log" DROP CONSTRAINT IF EXISTS "Log_ID_USER_fkey";
ALTER TABLE IF EXISTS "LogUserLoggedin" DROP CONSTRAINT IF EXISTS "LogUserLoggedin_ID_LOG_fkey";
ALTER TABLE IF EXISTS "LogUserLoggedin" DROP CONSTRAINT IF EXISTS "LogUserLoggedin_ID_USER_fkey";
ALTER TABLE IF EXISTS "LogUserLoggedout" DROP CONSTRAINT IF EXISTS "LogUserLoggedout_ID_LOG_fkey";
ALTER TABLE IF EXISTS "RightGroupLines" DROP CONSTRAINT IF EXISTS "RightGroupLines_ID_RIGHT_GROUP_fkey";
ALTER TABLE IF EXISTS "SystemRequirements" DROP CONSTRAINT IF EXISTS "SystemRequirements_ID_SYSTEM_UPDATE_fkey";
ALTER TABLE IF EXISTS "TmpBets" DROP CONSTRAINT IF EXISTS "TmpBets_ID_EVENT_INVENTORY_ITEM_fkey";
ALTER TABLE IF EXISTS "UserRightGroups" DROP CONSTRAINT IF EXISTS "UserRightGroups_ID_RIGHT_GROUP_fkey";
ALTER TABLE IF EXISTS "UserRightGroups" DROP CONSTRAINT IF EXISTS "UserRightGroups_ID_USER_fkey";

-- DropIndex (may not exist on shadow DB)
DROP INDEX IF EXISTS "EventRaceNumber_ID_NUMBER_GROUP_ID_EVENT_key";
DROP INDEX IF EXISTS "Partners_ID_EVENT_INVENTORY_ID_BREEDER_key";

-- AlterTable (conditional — these tables may have different state on shadow DB)
DO $$ BEGIN
  ALTER TABLE "AvgWinnerPrizes" ALTER COLUMN "ID_EVENT_INVENTORY_ITEM" DROP DEFAULT;
EXCEPTION WHEN others THEN NULL;
END $$;
DROP SEQUENCE IF EXISTS "avgwinnerprizes_id_event_inventory_item_seq";

-- Add PKs (conditional)
DO $$ BEGIN
  ALTER TABLE "EventRaceNumber" ADD CONSTRAINT "EventRaceNumber_pkey" PRIMARY KEY ("ID_EVENT", "ID_NUMBER_GROUP");
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Partners" ADD CONSTRAINT "Partners_pkey" PRIMARY KEY ("ID_BREEDER", "ID_EVENT_INVENTORY");
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RaceItemScan" ADD CONSTRAINT "RaceItemScan_pkey" PRIMARY KEY ("ID_RACE", "ID_RACE_ITEM");
EXCEPTION WHEN others THEN NULL;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "RaceItemScan_ID_RACE_ID_RACE_ITEM_key";

-- DropTable (legacy tables — may not exist on shadow DB)
DROP TABLE IF EXISTS "DatasyncSys";
DROP TABLE IF EXISTS "DatasyncWeb";
DROP TABLE IF EXISTS "IbeLogBlobFields";
DROP TABLE IF EXISTS "IbeLogFields";
DROP TABLE IF EXISTS "IbeLogKeys";
DROP TABLE IF EXISTS "IbeLogTables";
DROP TABLE IF EXISTS "Log";
DROP TABLE IF EXISTS "LogUserLoggedin";
DROP TABLE IF EXISTS "LogUserLoggedout";
DROP TABLE IF EXISTS "ReportClasses";
DROP TABLE IF EXISTS "ReportIds";
DROP TABLE IF EXISTS "Reports";
DROP TABLE IF EXISTS "RightGroupLines";
DROP TABLE IF EXISTS "RightGroups";
DROP TABLE IF EXISTS "SystemCfg";
DROP TABLE IF EXISTS "SystemInfo";
DROP TABLE IF EXISTS "SystemRequirements";
DROP TABLE IF EXISTS "SystemSession";
DROP TABLE IF EXISTS "SystemUpdates";
DROP TABLE IF EXISTS "TmpAvgSpeed";
DROP TABLE IF EXISTS "TmpBets";
DROP TABLE IF EXISTS "TmpId";
DROP TABLE IF EXISTS "UserRightGroups";

-- CreateTable
CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "imageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "username" TEXT,
    "displayUsername" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "phoneNumber" TEXT,
    "webAddress" TEXT,
    "ssn" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'BREEDER',
    "taxNumber" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RaceTypeFeeScheme" (
    "feeSchemeId" INTEGER NOT NULL,
    "raceTypeId" INTEGER NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "RaceTypeFeeScheme_pkey" PRIMARY KEY ("feeSchemeId","raceTypeId")
);

-- CreateIndex (conditional)
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_key" ON "user"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "user_username_key" ON "user"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "session_token_key" ON "session"("token");
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"("identifier");

-- AddForeignKey (conditional)
DO $$ BEGIN
  ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RaceTypeFeeScheme" ADD CONSTRAINT "RaceTypeFeeScheme_raceTypeId_fkey" FOREIGN KEY ("raceTypeId") REFERENCES "RaceType"("ID_RACE_TYPE") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RaceTypeFeeScheme" ADD CONSTRAINT "RaceTypeFeeScheme_feeSchemeId_fkey" FOREIGN KEY ("feeSchemeId") REFERENCES "FeeScheme"("ID_FEE_SCHEME") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AvgWinnerPrizes" ADD CONSTRAINT "AvgWinnerPrizes_ID_EVENT_INVENTORY_ITEM_fkey" FOREIGN KEY ("ID_EVENT_INVENTORY_ITEM") REFERENCES "EventInventoryItem"("ID_EVENT_INVENTORY_ITEM") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
