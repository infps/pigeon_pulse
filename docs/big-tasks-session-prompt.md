You are implementing a set of big features in the pigeon-pulse monorepo at `/home/sounak/programming/infinititech/pigeon-pulse`.

## Read first
1. `CLAUDE.md` (project context).
2. `docs/00-structure-graph.md` (repo map, domain model, status machines, where to look).
3. **`docs/pending-big-tasks.md` — the full spec. It is the source of truth for every feature, rule and design note below.**
4. `pigeon_pulse/prisma/schema.prisma`.
5. Root `tasks/todo.md`: the small tasks done last session. Reuse what they built (`components/document-preview.tsx`, `components/transfer-breeder.tsx`, `statusFromTotals` in `lib/paymentStatus.ts`, the breeder detail waiting toggle, etc.).

## Repos
- The web app `pigeon_pulse/` is its own git repo (remote `origin` = `infps/pigeon_pulse`). Last session's small tasks are committed on the branch `feat/small-pending-features` (commit `2176c2d`).
- Create `feat/big-tasks` from `feat/small-pending-features` and work there. Ignore the unrelated uncommitted files (`.claude/worktrees/*`, `scripts/import-live-receiver.mjs`, `tasks/todo.md`). Commit only when I ask, or ask at the end of each phase.
- Do not modify `agn-mobile/`. List mobile follow-ups per phase instead.

## Process
1. Enter plan mode. Read the spec and the code each phase touches. Then write `tasks/todo.md` (new section "Big tasks") with one checklist per phase.
   - Include the schema changes, migrations + backfills, API routes, UI files and verification steps.
   - End with the spec's "Open items" plus any new questions, extremely concise.
2. Wait for my OK on the plan before writing code.
3. Implement **one phase at a time**, in the spec's order:
   5a padding → A approval → B soft delete → C return bird → D payment request → E clear result/recalc → F % prizes per race → G payout → H dynamic tiers → I reports → J codes.
4. After each phase:
   - Run `npx tsc --noEmit` and the lint in `pigeon_pulse/`. No new errors.
   - Add one small runnable check for any money or ranking logic: prize pool + band split (F), tie split, tier payout (H), recalc ordering by scanner time (E), code formatting/next-number (J).
   - Tick the checklist and give me a short summary + mobile follow-ups.
5. Use subagents for exploration and for independent pieces. Use one subagent per focused task, and review their diffs yourself.

## Database rules
- Every schema change: `prisma migrate dev --create-only`. Show me the SQL (including backfills: existing registrations → APPROVED, prize slots → `Race.prizeSchemeId`, betting columns → tier rows, codes for existing rows). Apply it only to the **dev** DB, after I approve.
- Never run a migration against production. Never reset or drop a database.
- Additive first: new columns and tables, switch the reads, and drop old columns (`belgianShow1–7`, season prize slots, …) only in a later migration I approve.

## Key decisions already made (details in the spec)
- **Approval:**
  - Breeder self-registrations start WAITING; admin-created ones and existing ones are APPROVED.
  - Breeders can pay before approval.
  - Rejected after paying → a refund owed to the breeder, shown as due.
  - One shared "approved only" filter used everywhere.
- **Delete bird:** soft delete of the event entry only, with a restore button. Its fees are removed. Bets stay (cancelling one is a manual admin task).
- **Return bird:**
  - Scan shows the owner's name, address and payment details.
  - The bird is blocked from the remaining races in that season only.
  - Pay/refund option only if the breeder chose one.
- **Payment request:**
  - Two buttons, Entry Fee and Race Fee (for a picked race).
  - Targets PENDING + PARTIAL registrations (approved only).
  - Sent as in-app notification + email, with a PayPal link.
  - The message shows the amount paid and the remaining balance for PARTIAL.
  - No mailer exists yet: ask me before adding a provider or dependency.
- **Clear result:** unrank only (keep times and scans). Reverse prizes and bet payouts. Recalc re-ranks by scanner-recorded arrival time, not fetch time; fix that if it's wrong now.
- **Prizes:**
  - Bands are % of that race's pool, split across the positions in the band.
  - Pool = (paid + 75% of owed fees for that race) − organizer cut, cut subtracted first.
  - Prize scheme is per race (nullable), replacing the season slots.
  - UI shows computed amounts.
  - Tied birds split equally (HayLoft rule).
- **Payout:** the bird section shows prize + bet winnings. A per-event toggle (default admin only) decides whether breeders see it.
- **Betting tiers:** dynamic per scheme, no maximum, for Belgian/Standard/WTA. Existing bets stay valid.
- **Reports:** remove the central `/admin/reports` page. Each report moves to its section and gets a race picker plus an "All races" option, with preview before download. Propose the report → tab mapping and get my OK.
- **Codes:**
  - Keep int IDs; add a unique indexed `code` column.
  - Numbers are per event for breeder, race and bird. Events have their own number.
  - Codes like `EVE0027RACE00200`.
  - Ranges for all entities, auto-assigned but editable; race ranges labelled by race type.
  - Confirm prefixes and widths with me in the plan.

## Style
- Match the surrounding code (shadcn, TanStack Query wrappers in `lib/api/*`, `lib/endpoints.ts`, role/permission checks used by neighbouring routes).
- Smallest change that works: reuse existing helpers, no abstraction with one caller, and no new dependency without asking.
- If something in the spec conflicts with the code, stop and ask; don't guess.
