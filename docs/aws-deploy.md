# AWS Deployment Runbook

Console-only (no AWS CLI needed). Region: **us-west-2 (Oregon)** — closest cheap region to California.

## Architecture (~$33/mo)

```
Browser / mobile ──HTTPS──> EC2 t4g.small (Ubuntu, Docker)
                              ├─ caddy  (TLS, Let's Encrypt, :80/:443)
                              └─ app    (Next.js :3000, migrations on boot)
                                    │
                                    ├──> RDS Postgres db.t4g.micro (private)
                                    └──> S3 bucket ──> CloudFront (images/docs)
External, unchanged: PayPal, Windy, Pusher (Calcutta auction only)
```

| Item | $/mo |
|---|---|
| EC2 t4g.small + 30 GB gp3 + Elastic IP | ~17.5 |
| RDS db.t4g.micro single-AZ + 20 GB gp3 | ~14 |
| S3 (few GB) | <1 |
| CloudFront (1 TB + 10M req free tier) | 0 |
| Route 53 hosted zone (only if DNS moves to AWS) | 0.5 |

Things to have ready before starting:
- **Domain** the app will live at (e.g. `app.example.com`) and access to its DNS.
- GitHub access to `infps/pigeon_pulse` (to add a deploy key).
- Current production `.env` values (Neon URLs, R2 keys, PayPal, Pusher, Windy, `BETTER_AUTH_SECRET`, `CRON_SECRET`).

Placeholders used below: `DOMAIN`, `BUCKET`, `CF_DOMAIN` (e.g. `d123abc.cloudfront.net`), `RDS_HOST`, `DB_PASS`.

---

## 1. Security groups
EC2 console → **Security Groups** → Create (default VPC):

1. `pp-web` — Inbound: HTTP 80 from `0.0.0.0/0`, HTTPS 443 from `0.0.0.0/0`. No SSH (we use Session Manager).
2. `pp-db` — Inbound: PostgreSQL 5432, source = security group `pp-web`.

## 2. RDS Postgres
RDS → **Create database**:
- Standard create → PostgreSQL **17** (must be ≥ Neon's version; check Neon dashboard).
- Template: **Free tier** (or Dev/Test → Single-AZ).
- Identifier `pigeonpulse-db`, master user `pigeonpulse`, set `DB_PASS` (self-managed, save it).
- Instance: **db.t4g.micro**. Storage: gp3 20 GB, disable storage autoscaling (or cap at 50 GB).
- Connectivity: default VPC, **Public access: No**, security group `pp-db` (remove `default`).
- Additional config → Initial database name: `pigeonpulse`. Backups: 7 days. Enable deletion protection.
- Create. Once available, copy the **Endpoint** → `RDS_HOST`.

## 3. S3 bucket + CloudFront
1. S3 → **Create bucket** `BUCKET` (e.g. `pigeonpulse-media`), region us-west-2, keep **Block all public access ON**.
2. CloudFront → **Create distribution**:
   - Origin: the S3 bucket. Origin access: **Origin access control (OAC)** → create new.
   - Viewer protocol: Redirect HTTP to HTTPS. Cache policy: CachingOptimized. WAF: do not enable (costs money).
   - Create → click **Copy policy** banner → S3 bucket → Permissions → Bucket policy → paste → Save.
3. Copy distribution domain → `CF_DOMAIN`.

## 4. IAM role for EC2
IAM → Roles → **Create role** → AWS service → EC2:
- Attach `AmazonSSMManagedInstanceCore` (browser shell access).
- Name `pp-ec2-role`. After creating: Add permissions → **Create inline policy** → JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::BUCKET" },
    { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::BUCKET/*" }
  ]
}
```

The app uses this role for uploads — no S3 access keys stored anywhere.

## 5. EC2 instance
EC2 → **Launch instance**:
- Name `pigeonpulse-app`. AMI: **Ubuntu Server 24.04 LTS, 64-bit (Arm)**.
- Type **t4g.small**. Key pair: proceed without (Session Manager instead).
- Network: default VPC, security group `pp-web`, auto-assign public IP on.
- Storage: 30 GB gp3.
- Advanced → IAM instance profile: `pp-ec2-role`.
- Launch. Then EC2 → **Elastic IPs** → Allocate → Associate with the instance. Note the IP.

## 6. DNS
At your DNS provider, create an **A record** `DOMAIN` → Elastic IP. (If DNS is on Cloudflare, set it to *DNS only* / grey cloud, or Caddy cannot issue the certificate.)

## 7. Server setup
EC2 → instance → **Connect → Session Manager → Connect**. Then:

```bash
sudo -i
# Docker + compose
curl -fsSL https://get.docker.com | sh
# 2 GB swap so `next build` fits in 2 GB RAM
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
# GitHub deploy key
ssh-keygen -t ed25519 -N "" -f /root/.ssh/id_ed25519 && cat /root/.ssh/id_ed25519.pub
```

GitHub → `infps/pigeon_pulse` → Settings → Deploy keys → Add (read-only) → paste the key. Then:

```bash
ssh-keyscan github.com >> /root/.ssh/known_hosts
git clone git@github.com:infps/pigeon_pulse.git /opt/pigeon_pulse
cd /opt/pigeon_pulse
cp .env.example .env && nano .env
```

### `.env` values that differ from Vercel

```bash
DOMAIN=app.example.com

# sslmode=no-verify: encrypted, but skips CA check (RDS CA isn't in Node's trust store)
DATABASE_URL="postgresql://pigeonpulse:DB_PASS@RDS_HOST:5432/pigeonpulse?sslmode=no-verify"
DIRECT_URL="postgresql://pigeonpulse:DB_PASS@RDS_HOST:5432/pigeonpulse?sslmode=no-verify"

BETTER_AUTH_URL=https://app.example.com
NEXT_PUBLIC_AUTH_BASE_URL=https://app.example.com
NEXT_PUBLIC_API_URL=

# S3: leave R2_ENDPOINT and R2 keys EMPTY -> uses AWS_REGION + EC2 role
AWS_REGION=us-west-2
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=BUCKET
R2_PUBLIC_URL=https://CF_DOMAIN

CRON_SECRET=<same as Vercel or new: openssl rand -hex 32>
```

Copy the rest (`BETTER_AUTH_SECRET` — **keep the same value** or everyone is logged out, PayPal, Pusher, Windy) from Vercel.

**Do not start the app yet** — the database is empty. Do step 8 first.

## 8. Data migration (Neon → RDS, R2 → S3)

Pick a quiet time. Old app on Vercel keeps running until DNS switches; any writes to Neon after the dump are lost, so avoid admin work during the window.

### 8a. Database
Use Neon's **direct** (non-pooler) URL:

```bash
cd /opt/pigeon_pulse
NEON='postgresql://USER:PASS@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require'
RDS='postgresql://pigeonpulse:DB_PASS@RDS_HOST:5432/pigeonpulse?sslmode=require'

docker run --rm -v /opt:/w postgres:17 pg_dump "$NEON" -Fc --no-owner --no-acl -f /w/neon.dump
docker run --rm -v /opt:/w postgres:17 pg_restore --no-owner --no-acl -d "$RDS" /w/neon.dump
```

`pg_restore` may print warnings about Neon-specific extensions/roles; table data errors are not OK — rerun into a fresh DB if any appear.

Check row counts match (run against both URLs):

```bash
docker run --rm postgres:17 psql "$RDS" -c 'select (select count(*) from "Bird") birds, (select count(*) from "RaceItem") race_items, (select count(*) from "user") users;'
```

### 8b. Files
```bash
docker run --rm \
  -e RCLONE_CONFIG_R2_TYPE=s3 -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  -e RCLONE_CONFIG_R2_ACCESS_KEY_ID=<R2 key> -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=<R2 secret> \
  -e RCLONE_CONFIG_R2_ENDPOINT=<R2_ENDPOINT> \
  -e RCLONE_CONFIG_S3_TYPE=s3 -e RCLONE_CONFIG_S3_PROVIDER=AWS \
  -e RCLONE_CONFIG_S3_ENV_AUTH=true -e RCLONE_CONFIG_S3_REGION=us-west-2 \
  rclone/rclone sync r2:<R2 bucket> s3:BUCKET --progress
```

### 8c. Rewrite stored image URLs
DB stores full URLs (`https://pub-….r2.dev/...`). Replace the prefix in every text column. Edit the two URLs, then run with `psql "$RDS"`:

```sql
DO $$
DECLARE
  old_prefix text := 'https://pub-a39a3b5950f34f50bb2158b6cf756558.r2.dev';
  new_prefix text := 'https://CF_DOMAIN';
  r record; n int;
BEGIN
  FOR r IN SELECT table_name, column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND data_type IN ('text', 'character varying') LOOP
    EXECUTE format('UPDATE public.%I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L',
      r.table_name, r.column_name, r.column_name, old_prefix, new_prefix,
      r.column_name, '%' || old_prefix || '%');
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE NOTICE '%.%: % rows', r.table_name, r.column_name, n; END IF;
  END LOOP;
END $$;
```

Rich-text / markdown columns are text too, so embedded images get rewritten as well.

## 9. Start the app
```bash
cd /opt/pigeon_pulse
docker compose up -d --build     # first build ~5-10 min on t4g.small
docker compose logs -f app       # expect migrations "No pending migrations" then "Ready"
```

Caddy gets the HTTPS certificate automatically once DNS points at the Elastic IP.

### Daily cron (replaces Vercel cron, 09:00 UTC)
```bash
crontab -e
# add:
0 9 * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://DOMAIN/api/cron/notify-daily >/dev/null
```

## 10. External updates
- **PayPal** developer dashboard → webhook URL → `https://DOMAIN/api/payment/paypal/webhook` (update `PAYPAL_WEBHOOK_ID` in `.env` if a new webhook is created, then `docker compose up -d`).
- **Mobile app** (`agn-mobile`): replace `https://pigeon-pulse.vercel.app` with `https://DOMAIN` in `eas.json`, `service/api.service.ts`, `app/(app)/liberation.tsx`; rebuild via EAS.
- **Vercel**: after verification, remove the production domain / pause the project so nothing writes to Neon.
- Keep Neon + R2 for ~2 weeks as rollback, then delete.

## 11. Verify
- [ ] `https://DOMAIN/api/ping` → `{"ok":true}`
- [ ] Log in with an existing account (session secret carried over)
- [ ] Existing bird photos / event logos load (from `CF_DOMAIN`)
- [ ] Upload a new bird photo → appears in S3 bucket, loads in UI
- [ ] Open a live/finished race page
- [ ] Calcutta page receives Pusher updates
- [ ] PayPal sandbox payment + webhook arrives
- [ ] Trigger cron manually with the curl line above
- [ ] Mobile app logs in against new domain

## Deploying updates
```bash
cd /opt/pigeon_pulse && git pull && docker compose up -d --build
```
Build happens before the container swap; downtime is a few seconds.

## Known gotchas
- **Fresh empty DB can't be migrated**: `20260309_schema_cleanup` fails on an empty database. Irrelevant here (the Neon restore carries `_prisma_migrations`), but a brand-new environment needs `prisma db push` instead of `migrate deploy`.
- `scripts/migrate.js` prints two `P3011 ... cannot be rolled back` errors on every boot — harmless.
- `NEXT_PUBLIC_*` and `R2_PUBLIC_URL` are baked in at build time: change them → `docker compose up -d --build`, not just restart.
- Backups: RDS automated daily snapshots (7 days). Take a manual snapshot before risky migrations.
