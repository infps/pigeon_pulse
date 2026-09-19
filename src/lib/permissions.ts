/**
 * Role-based access control.
 *
 * HayLoft had this and it was deliberately not ported during the conversion:
 * RIGHT_GROUPS / RIGHT_GROUP_LINES held a RIGHT_CODE and a GRANT_LEVEL, but
 * production carried exactly one group with four lines, so the flat roles were
 * a fair trade at the time. This is that idea rebuilt for the modules the
 * system actually has now.
 *
 * Three layers, most specific wins:
 *
 *   1. a per-user grant or revoke   (UserPermission)
 *   2. a per-role grant or revoke   (RolePermission)
 *   3. the built-in default for the role (DEFAULTS below)
 *
 * A user override can *remove* a permission the role grants, not only add one —
 * "this admin does not touch payments" has to be expressible, or the system
 * only does half the job.
 *
 * Permission codes are `module.action`. They live in code rather than the
 * database because they are referenced by name at call sites: a code that can
 * be renamed or deleted from a UI is a silent authorization hole.
 */

import type { UserRole } from "@/generated/prisma/enums";

export type PermissionAction = "view" | "manage";

export interface PermissionDef {
  code: string;
  module: string;
  label: string;
  /** What someone with this permission can actually do. */
  description: string;
  action: PermissionAction | string;
}

export interface ModuleDef {
  key: string;
  label: string;
  description: string;
  permissions: PermissionDef[];
}

function mod(
  key: string,
  label: string,
  description: string,
  extras: Array<{ action: string; label: string; description: string }> = []
): ModuleDef {
  const permissions: PermissionDef[] = [
    {
      code: `${key}.view`,
      module: key,
      action: "view",
      label: `View ${label.toLowerCase()}`,
      description: `Read ${label.toLowerCase()} without changing anything.`,
    },
    {
      code: `${key}.manage`,
      module: key,
      action: "manage",
      label: `Manage ${label.toLowerCase()}`,
      description,
    },
    ...extras.map((e) => ({
      code: `${key}.${e.action}`,
      module: key,
      action: e.action,
      label: e.label,
      description: e.description,
    })),
  ];
  return { key, label, description, permissions };
}

/** Every module the admin surface exposes. */
export const MODULES: ModuleDef[] = [
  mod("events", "Events", "Create and edit events, seasons and their settings."),
  mod("races", "Races", "Create races, start and end them, and correct results.", [
    {
      action: "recalculate",
      label: "Recalculate results",
      description: "Rebuild finishing positions and prize money for a race.",
    },
  ]),
  mod("breeders", "Breeders", "Add and edit breeders and their registrations."),
  mod("birds", "Birds", "Add and edit birds, bands, health and pedigree."),
  mod("checkin", "Check-in", "Link RFID tags and run the arrival check-in."),
  mod("baskets", "Baskets", "Create baskets and assign birds to them."),
  mod("groups", "Groups", "Manage loft sections, groups and vaccinations."),
  mod("betting", "Betting", "Open and close pools, place cash bets.", [
    {
      action: "payouts",
      label: "Settle payouts",
      description: "Calculate and commit betting payouts. Moves money.",
    },
  ]),
  mod("classes", "Classes", "Create classes and class fees.", [
    {
      action: "payouts",
      label: "Settle class payouts",
      description: "Calculate and commit class payouts. Moves money.",
    },
  ]),
  mod("payments", "Payments", "Record and adjust payments."),
  mod("refunds", "Refunds", "Issue refunds against registrations. Moves money."),
  mod("accounting", "Accounting", "Read the ledger, invoices and prize statements."),
  mod("penalties", "Penalties", "Charge and waive late-payment penalties.", [
    {
      action: "waive",
      label: "Waive penalties",
      description: "Cancel a charged penalty. Kept on record with a reason.",
    },
  ]),
  mod("store", "Event store", "List defaulter birds and assign buyers."),
  mod("schemes", "Schemes", "Edit fee, prize and betting schemes."),
  mod("stations", "Stations", "Manage liberation points."),
  mod("tournaments", "Knockout", "Run knockout tournaments and apply cuts."),
  mod("calcutta", "Calcutta", "Run the Calcutta auction."),
  mod("messages", "Messages", "Broadcast messages to breeders."),
  mod("content", "Rules & videos", "Publish event rules, fees and videos."),
  mod("reports", "Reports", "Generate and download reports."),
  mod("scanners", "Scanners", "Map scanners to loft sections."),
  mod("users", "Users", "Edit user accounts and roles.", [
    {
      action: "approve",
      label: "Approve registrations",
      description: "Approve or decline new sign-ups.",
    },
    {
      action: "permissions",
      label: "Assign permissions",
      description: "Grant and revoke what other people can do. Give sparingly.",
    },
  ]),
];

export const ALL_PERMISSIONS: PermissionDef[] = MODULES.flatMap((m) => m.permissions);

const PERMISSION_CODES = new Set(ALL_PERMISSIONS.map((p) => p.code));

export function isKnownPermission(code: string): boolean {
  return PERMISSION_CODES.has(code);
}

/**
 * Built-in defaults.
 *
 * SUPERADMIN is deliberately absent: it is not a long permission list but a
 * bypass, so that nobody can lock themselves out of the screen that hands out
 * permissions. ADMIN gets the operational surface but not user administration
 * or permission assignment — those escalate, so they start closed.
 */
const ADMIN_DEFAULTS: string[] = [
  ...MODULES.filter((m) => m.key !== "users")
    .flatMap((m) => m.permissions.map((p) => p.code)),
  "users.view",
];

const DEFAULTS: Record<string, string[]> = {
  SUPERADMIN: [],
  ADMIN: ADMIN_DEFAULTS,
  // A breeder or bettor has no admin permissions at all; their access comes
  // from owning the records, not from this system.
  BREEDER: [],
  BETTOR: [],
};

export function hasDefault(role: UserRole | string | null | undefined, code: string): boolean {
  if (!role) return false;
  return (DEFAULTS[role] ?? []).includes(code);
}

export function isSuperAdmin(role: UserRole | string | null | undefined): boolean {
  return role === "SUPERADMIN";
}

export interface PermissionGrant {
  permission: string;
  allowed: boolean;
}

/**
 * Resolve one permission for a user.
 *
 * Superadmin short-circuits to true. Otherwise the most specific rule wins:
 * a user grant, then a role grant, then the built-in default.
 */
export function resolvePermission(
  role: UserRole | string | null | undefined,
  code: string,
  roleGrants: PermissionGrant[],
  userGrants: PermissionGrant[]
): boolean {
  if (isSuperAdmin(role)) return true;

  const userRule = userGrants.find((g) => g.permission === code);
  if (userRule) return userRule.allowed;

  const roleRule = roleGrants.find((g) => g.permission === code);
  if (roleRule) return roleRule.allowed;

  return hasDefault(role, code);
}

/** The full set a user holds, for sending to a client that hides what it cannot use. */
export function resolveAll(
  role: UserRole | string | null | undefined,
  roleGrants: PermissionGrant[],
  userGrants: PermissionGrant[]
): string[] {
  if (isSuperAdmin(role)) return ALL_PERMISSIONS.map((p) => p.code);
  return ALL_PERMISSIONS.map((p) => p.code).filter((code) =>
    resolvePermission(role, code, roleGrants, userGrants)
  );
}
