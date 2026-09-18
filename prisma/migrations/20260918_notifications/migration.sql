-- Notifications.
--
-- The reference document lists a Notification model and pages as existing with
-- "no triggers currently fire" — in fact there was no model at all, only a page
-- rendering an empty array. This adds the model and the triggers behind it.
--
-- Delivery is in-app first: rows here are the source of truth and the feed reads
-- them. Push (FCM or web push) can be layered on later by walking unsent rows,
-- which is why DELIVERED_AT exists.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationKind') THEN
    CREATE TYPE "NotificationKind" AS ENUM (
      'RACE_STARTED',
      'BIRD_ARRIVED',
      'RACE_ENDED',
      'BETTING_OPEN',
      'PAYMENT_DUE',
      'EVENT_MESSAGE',
      'BIRD_LOST',
      'STORE_LISTING'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Notifications" (
  "ID_NOTIFICATION" SERIAL PRIMARY KEY,
  "USER_ID"      TEXT NOT NULL,
  "KIND"         "NotificationKind" NOT NULL,
  "TITLE"        TEXT NOT NULL,
  "BODY"         TEXT NOT NULL,
  -- Where tapping the notification should go.
  "LINK"         TEXT,
  "SEASON_ID"    INTEGER,
  "ID_RACE"      INTEGER,
  "READ_AT"      TIMESTAMP(3),
  "DELIVERED_AT" TIMESTAMP(3),
  "CREATED_AT"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notifications_user_fkey"
    FOREIGN KEY ("USER_ID") REFERENCES "Users"("id") ON DELETE CASCADE,
  CONSTRAINT "Notifications_season_fkey"
    FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id") ON DELETE SET NULL,
  CONSTRAINT "Notifications_race_fkey"
    FOREIGN KEY ("ID_RACE") REFERENCES "Race"("ID_RACE") ON DELETE SET NULL
);

-- The feed query: this user, newest first, unread first.
CREATE INDEX IF NOT EXISTS "Notifications_user_created_idx"
  ON "Notifications" ("USER_ID", "CREATED_AT" DESC);

-- The unread badge count.
CREATE INDEX IF NOT EXISTS "Notifications_user_unread_idx"
  ON "Notifications" ("USER_ID") WHERE "READ_AT" IS NULL;
