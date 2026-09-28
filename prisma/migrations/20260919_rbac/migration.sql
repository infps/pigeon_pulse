-- Role-based access control.
--
-- Rebuilds what HayLoft carried in RIGHT_GROUPS / RIGHT_GROUP_LINES
-- (RIGHT_CODE + GRANT_LEVEL), which was skipped during the conversion because
-- production held one group with four lines.
--
-- Two grant tables rather than one: a role-level rule that applies to everyone
-- with that role, and a user-level rule that overrides it. Both carry ALLOWED
-- rather than merely existing, so a grant can *remove* something the role
-- otherwise gives — "this admin does not touch payments" has to be expressible.
--
-- Permission codes are not a table. They are referenced by name at call sites,
-- and a code that can be renamed or deleted from a UI is a silent hole.

CREATE TABLE IF NOT EXISTS "RolePermissions" (
  "ROLE"       TEXT NOT NULL,
  "PERMISSION" TEXT NOT NULL,
  "ALLOWED"    BOOLEAN NOT NULL DEFAULT true,
  "UPDATED_AT" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UPDATED_BY" TEXT,

  PRIMARY KEY ("ROLE", "PERMISSION")
);

CREATE TABLE IF NOT EXISTS "UserPermissions" (
  "USER_ID"    TEXT NOT NULL,
  "PERMISSION" TEXT NOT NULL,
  "ALLOWED"    BOOLEAN NOT NULL DEFAULT true,
  "UPDATED_AT" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UPDATED_BY" TEXT,

  PRIMARY KEY ("USER_ID", "PERMISSION"),
  CONSTRAINT "UserPermissions_user_fkey"
    FOREIGN KEY ("USER_ID") REFERENCES "Users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserPermissions_user_idx" ON "UserPermissions" ("USER_ID");

-- No rows are seeded. An empty table means "use the built-in defaults", so
-- every existing admin keeps exactly the access they have today and nothing
-- changes until somebody deliberately edits the matrix.
