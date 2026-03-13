-- Add userId column to Breeders table (nullable for legacy breeders)
ALTER TABLE "Breeders" ADD COLUMN "USER_ID" TEXT;

-- Create unique index
CREATE UNIQUE INDEX "Breeders_USER_ID_key" ON "Breeders"("USER_ID");

-- Add FK constraint
ALTER TABLE "Breeders" ADD CONSTRAINT "Breeders_USER_ID_fkey"
  FOREIGN KEY ("USER_ID") REFERENCES "Users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: Link existing breeders to users by matching email
UPDATE "Breeders" b
SET "USER_ID" = u."id"
FROM "Users" u
WHERE b."EMAIL" = u."email"
  AND b."USER_ID" IS NULL;
