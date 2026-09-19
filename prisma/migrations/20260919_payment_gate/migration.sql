-- Optional payment gate on registration.
--
-- The reference document lists this as deferred: "Registration always succeeds
-- without payment." Whether that is right is a club policy rather than an
-- engineering question, so this makes it a setting instead of a hard rule.
--
-- Default false, which preserves exactly the behaviour every existing season has
-- today: registration completes and leaves a PENDING payment behind.
ALTER TABLE "FeeScheme"
  ADD COLUMN IF NOT EXISTS "REQUIRE_PAYMENT_TO_REGISTER" BOOLEAN NOT NULL DEFAULT false;
