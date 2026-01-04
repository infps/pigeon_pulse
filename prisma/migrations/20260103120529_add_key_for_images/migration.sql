-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "bannerImageKey" TEXT,
ADD COLUMN     "logoImageKey" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "imageKey" TEXT;
