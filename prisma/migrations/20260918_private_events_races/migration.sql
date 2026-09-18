-- Private events and races.
--
-- Listed in the reference document as "Private events/races — Planned: hide from
-- non-registered breeders". A private event is visible only to breeders who hold
-- a registration in one of its seasons; a private race is visible only to
-- breeders with a bird entered in it.
--
-- Admins and superadmins always see everything.

ALTER TABLE "Events" ADD COLUMN IF NOT EXISTS "IS_PRIVATE" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Race"  ADD COLUMN IF NOT EXISTS "IS_PRIVATE" BOOLEAN NOT NULL DEFAULT false;
