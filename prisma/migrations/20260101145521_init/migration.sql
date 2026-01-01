-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PROSPECT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BREEDER', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "BirdSex" AS ENUM ('COCK', 'HEN', 'UNKNOWN');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
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
CREATE TABLE "RaceType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeScheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isRefundable" BOOLEAN NOT NULL DEFAULT false,
    "maxBirds" INTEGER NOT NULL DEFAULT 0,
    "feesCutPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "FeeScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerchFeeItem" (
    "feeSchemeId" TEXT NOT NULL,
    "birdNo" INTEGER NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PerchFeeItem_pkey" PRIMARY KEY ("feeSchemeId","birdNo")
);

-- CreateTable
CREATE TABLE "RaceTypeFeeScheme" (
    "feeSchemeId" TEXT NOT NULL,
    "raceTypeId" TEXT NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "RaceTypeFeeScheme_pkey" PRIMARY KEY ("feeSchemeId","raceTypeId")
);

-- CreateTable
CREATE TABLE "PrizeScheme" (
    "prizeSchemeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "PrizeScheme_pkey" PRIMARY KEY ("prizeSchemeId")
);

-- CreateTable
CREATE TABLE "PrizeSchemeItem" (
    "prizeSchemeId" TEXT NOT NULL,
    "raceTypeId" TEXT NOT NULL,
    "fromPosition" INTEGER NOT NULL,
    "toPosition" INTEGER NOT NULL,
    "prizeAmount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PrizeSchemeItem_pkey" PRIMARY KEY ("prizeSchemeId","raceTypeId","fromPosition","toPosition")
);

-- CreateTable
CREATE TABLE "BettingScheme" (
    "bettingSchemeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bettingCutPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "belgianShow1" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "belgianShow2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "belgianShow3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "belgianShow4" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "belgianShow5" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "belgianShow6" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "belgianShow7" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "standardShow1" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "standardShow2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "standardShow3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "standardShow4" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "standardShow5" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wta1" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wta2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wta3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wta4" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wta5" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "BettingScheme_pkey" PRIMARY KEY ("bettingSchemeId")
);

-- CreateTable
CREATE TABLE "EventType" (
    "eventTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventType_pkey" PRIMARY KEY ("eventTypeId")
);

-- CreateTable
CREATE TABLE "Event" (
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bannerImage" TEXT,
    "logoImage" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "typeId" TEXT NOT NULL,
    "feeSchemeId" TEXT NOT NULL,
    "prizeSchemeId" TEXT NOT NULL,
    "bettingSchemeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "contactWebsite" TEXT,
    "contactAddress" TEXT,
    "socialYt" TEXT,
    "socialFb" TEXT,
    "socialTwitter" TEXT,
    "socialInsta" TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "Bird" (
    "birdId" TEXT NOT NULL,
    "band" TEXT NOT NULL,
    "band1" TEXT NOT NULL,
    "band2" TEXT NOT NULL,
    "band3" TEXT NOT NULL,
    "band4" TEXT NOT NULL,
    "birdName" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "rfid" TEXT,
    "sex" "BirdSex" NOT NULL DEFAULT 'COCK',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "lostDate" TIMESTAMP(3),
    "lostRaceId" TEXT,
    "note" TEXT,
    "picture" TEXT,
    "breederId" TEXT NOT NULL,

    CONSTRAINT "Bird_pkey" PRIMARY KEY ("birdId")
);

-- CreateTable
CREATE TABLE "EventInventory" (
    "eventInventoryId" TEXT NOT NULL,
    "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservedBirds" INTEGER NOT NULL,
    "loft" TEXT NOT NULL,
    "note" TEXT,
    "breederId" TEXT NOT NULL,

    CONSTRAINT "EventInventory_pkey" PRIMARY KEY ("eventInventoryId")
);

-- CreateTable
CREATE TABLE "EventInventoryItem" (
    "eventInventoryItemId" TEXT NOT NULL,
    "birdId" TEXT NOT NULL,
    "eventInventoryId" TEXT NOT NULL,
    "birdNo" INTEGER NOT NULL,
    "arrivalTime" TIMESTAMP(3),
    "departureTime" TIMESTAMP(3),
    "perchFeeValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "entryFeeRefunded" BOOLEAN NOT NULL DEFAULT false,
    "entryFeePaid" BOOLEAN NOT NULL DEFAULT false,
    "isBackup" BOOLEAN NOT NULL DEFAULT false,
    "belgianShowBet1" BOOLEAN NOT NULL DEFAULT false,
    "belgianShowBet2" BOOLEAN NOT NULL DEFAULT false,
    "belgianShowBet3" BOOLEAN NOT NULL DEFAULT false,
    "belgianShowBet4" BOOLEAN NOT NULL DEFAULT false,
    "belgianShowBet5" BOOLEAN NOT NULL DEFAULT false,
    "belgianShowBet6" BOOLEAN NOT NULL DEFAULT false,
    "belgianShowBet7" BOOLEAN NOT NULL DEFAULT false,
    "standardShowBet1" BOOLEAN NOT NULL DEFAULT false,
    "standardShowBet2" BOOLEAN NOT NULL DEFAULT false,
    "standardShowBet3" BOOLEAN NOT NULL DEFAULT false,
    "standardShowBet4" BOOLEAN NOT NULL DEFAULT false,
    "standardShowBet5" BOOLEAN NOT NULL DEFAULT false,
    "wtaBet1" BOOLEAN NOT NULL DEFAULT false,
    "wtaBet2" BOOLEAN NOT NULL DEFAULT false,
    "wtaBet3" BOOLEAN NOT NULL DEFAULT false,
    "wtaBet4" BOOLEAN NOT NULL DEFAULT false,
    "wtaBet5" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EventInventoryItem_pkey" PRIMARY KEY ("eventInventoryItemId")
);

-- CreateTable
CREATE TABLE "Basket" (
    "basketId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "basketNo" INTEGER NOT NULL,
    "isRaceBasket" BOOLEAN NOT NULL DEFAULT false,
    "raceId" TEXT NOT NULL,

    CONSTRAINT "Basket_pkey" PRIMARY KEY ("basketId")
);

-- CreateTable
CREATE TABLE "Race" (
    "raceId" TEXT NOT NULL,
    "raceTypeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "distance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "releaseStation" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "sunriseTime" TIMESTAMP(3) NOT NULL,
    "sunsetTime" TIMESTAMP(3) NOT NULL,
    "arrivalTemperature" DOUBLE PRECISION,
    "arrivalWind" TEXT,
    "arrivalWeather" TEXT,
    "releaseTemperature" DOUBLE PRECISION,
    "releaseWind" TEXT,
    "releaseWeather" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Race_pkey" PRIMARY KEY ("raceId")
);

-- CreateTable
CREATE TABLE "RaceItem" (
    "raceItemId" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "birdId" TEXT NOT NULL,
    "eventInventoryItemId" TEXT NOT NULL,
    "isLoftBasketed" BOOLEAN NOT NULL DEFAULT false,
    "isRaceBasketed" BOOLEAN NOT NULL DEFAULT false,
    "raceBasketedAt" TIMESTAMP(3),
    "loftBasketId" TEXT,
    "raceBasketId" TEXT,
    "birdPosition" INTEGER,
    "arrivalTime" TIMESTAMP(3),
    "speed" DOUBLE PRECISION,
    "prizeValue" DOUBLE PRECISION,

    CONSTRAINT "RaceItem_pkey" PRIMARY KEY ("raceItemId")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "breederId" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
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
CREATE TABLE "account" (
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
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EventInventoryPartners" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EventInventoryPartners_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "RaceType_name_key" ON "RaceType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FeeScheme_name_key" ON "FeeScheme"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeScheme_name_key" ON "PrizeScheme"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BettingScheme_name_key" ON "BettingScheme"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EventType_name_key" ON "EventType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Bird_band_key" ON "Bird"("band");

-- CreateIndex
CREATE UNIQUE INDEX "Bird_rfid_key" ON "Bird"("rfid");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_breederId_key" ON "Team"("name", "breederId");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "_EventInventoryPartners_B_index" ON "_EventInventoryPartners"("B");

-- AddForeignKey
ALTER TABLE "FeeScheme" ADD CONSTRAINT "FeeScheme_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerchFeeItem" ADD CONSTRAINT "PerchFeeItem_feeSchemeId_fkey" FOREIGN KEY ("feeSchemeId") REFERENCES "FeeScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceTypeFeeScheme" ADD CONSTRAINT "RaceTypeFeeScheme_raceTypeId_fkey" FOREIGN KEY ("raceTypeId") REFERENCES "RaceType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceTypeFeeScheme" ADD CONSTRAINT "RaceTypeFeeScheme_feeSchemeId_fkey" FOREIGN KEY ("feeSchemeId") REFERENCES "FeeScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeScheme" ADD CONSTRAINT "PrizeScheme_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeSchemeItem" ADD CONSTRAINT "PrizeSchemeItem_prizeSchemeId_fkey" FOREIGN KEY ("prizeSchemeId") REFERENCES "PrizeScheme"("prizeSchemeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeSchemeItem" ADD CONSTRAINT "PrizeSchemeItem_raceTypeId_fkey" FOREIGN KEY ("raceTypeId") REFERENCES "RaceType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BettingScheme" ADD CONSTRAINT "BettingScheme_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "EventType"("eventTypeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_feeSchemeId_fkey" FOREIGN KEY ("feeSchemeId") REFERENCES "FeeScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_prizeSchemeId_fkey" FOREIGN KEY ("prizeSchemeId") REFERENCES "PrizeScheme"("prizeSchemeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_bettingSchemeId_fkey" FOREIGN KEY ("bettingSchemeId") REFERENCES "BettingScheme"("bettingSchemeId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bird" ADD CONSTRAINT "Bird_lostRaceId_fkey" FOREIGN KEY ("lostRaceId") REFERENCES "Race"("raceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bird" ADD CONSTRAINT "Bird_breederId_fkey" FOREIGN KEY ("breederId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInventory" ADD CONSTRAINT "EventInventory_breederId_fkey" FOREIGN KEY ("breederId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInventoryItem" ADD CONSTRAINT "EventInventoryItem_eventInventoryId_fkey" FOREIGN KEY ("eventInventoryId") REFERENCES "EventInventory"("eventInventoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInventoryItem" ADD CONSTRAINT "EventInventoryItem_birdId_fkey" FOREIGN KEY ("birdId") REFERENCES "Bird"("birdId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Basket" ADD CONSTRAINT "Basket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Basket" ADD CONSTRAINT "Basket_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("raceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Race" ADD CONSTRAINT "Race_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Race" ADD CONSTRAINT "Race_raceTypeId_fkey" FOREIGN KEY ("raceTypeId") REFERENCES "RaceType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceItem" ADD CONSTRAINT "RaceItem_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("raceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceItem" ADD CONSTRAINT "RaceItem_birdId_fkey" FOREIGN KEY ("birdId") REFERENCES "Bird"("birdId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceItem" ADD CONSTRAINT "RaceItem_eventInventoryItemId_fkey" FOREIGN KEY ("eventInventoryItemId") REFERENCES "EventInventoryItem"("eventInventoryItemId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceItem" ADD CONSTRAINT "RaceItem_loftBasketId_fkey" FOREIGN KEY ("loftBasketId") REFERENCES "Basket"("basketId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceItem" ADD CONSTRAINT "RaceItem_raceBasketId_fkey" FOREIGN KEY ("raceBasketId") REFERENCES "Basket"("basketId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_breederId_fkey" FOREIGN KEY ("breederId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventInventoryPartners" ADD CONSTRAINT "_EventInventoryPartners_A_fkey" FOREIGN KEY ("A") REFERENCES "EventInventory"("eventInventoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventInventoryPartners" ADD CONSTRAINT "_EventInventoryPartners_B_fkey" FOREIGN KEY ("B") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
