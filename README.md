# Pigeon Pulse

Pigeon racing management: admin + breeder web app and every API the mobile app (`agn-mobile`) calls. Next.js 16, Prisma 7, Postgres, better-auth.

## Run locally

```bash
cp .env.example .env   # fill in; each variable is explained in the file
pnpm install           # also runs `prisma generate`
pnpm dev               # http://localhost:3000
```

`prisma/schema.prisma` is the data model. A fresh empty database can't replay the migration chain — use `pnpm exec prisma db push`, or restore a dump.

## Docs

| File | What |
|---|---|
| `docs/deploy-aws.md` | How production runs on AWS and how to deploy |
| `docs/pending-big-tasks.md` | Spec for the features still to build |
| `docs/payment-spec-questions.md` | Payment rule decisions (referenced from `src/lib/fee-calculator.ts`) |
| `docs/scheme-wiring-audit.md` | Which fee/prize scheme fields are wired vs. stored-only |
| `docs/hayloft-comparison.md`, `docs/hayloft-schema-reference.sql` | Legacy HayLoft system this replaces — reference for parity |
