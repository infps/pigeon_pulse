-- Registration approval.
--
-- From the requirements: "When registering for new users, the admin must be
-- able to see their details, approve or decline the user access, and if
-- declined dont remove it, just flag it to make it just like a guest user. And
-- the super admin can manage the access of these users."
--
-- Approval is tracked separately from UserStatus. UserStatus is about whether an
-- account is live at all; approval is about whether an organizer has vetted this
-- person. Conflating them would make "declined" indistinguishable from
-- "deactivated", and the requirement is explicit that a decline keeps the
-- account and only reduces it to guest-level access.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalStatus') THEN
    CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');
  END IF;
END $$;

ALTER TABLE "Users"
  ADD COLUMN IF NOT EXISTS "APPROVAL_STATUS" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "APPROVAL_DECIDED_AT" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "APPROVAL_DECIDED_BY" TEXT,
  ADD COLUMN IF NOT EXISTS "APPROVAL_NOTE" TEXT;

-- Everyone already in the system predates approval and has been operating as a
-- real user, so they are approved. Only accounts created from here on start as
-- pending — otherwise this migration would lock out 1,200 existing breeders.
UPDATE "Users" SET "APPROVAL_STATUS" = 'APPROVED', "APPROVAL_DECIDED_AT" = CURRENT_TIMESTAMP
WHERE "APPROVAL_STATUS" = 'PENDING';

-- The approval queue reads pending-first, newest-first.
CREATE INDEX IF NOT EXISTS "Users_approval_idx"
  ON "Users" ("APPROVAL_STATUS", "createdAt" DESC);
