# Deploying on AWS

Infrastructure lives in the separate **`infra`** repo (Terraform + Ansible). This page is the short version; `infra/README.md` has the full permission list.

## What runs where (us-west-2, ~$35/mo)

| Piece | AWS | Notes |
|---|---|---|
| App | EC2 `t4g.small` (Ubuntu arm64), Elastic IP | Docker Compose: `app` (this repo's `Dockerfile`) + `caddy` (HTTPS) |
| Database | RDS Postgres 17 `db.t4g.micro` | Private; only the EC2 security group can reach it. 7-day backups |
| Uploads | S3 bucket + CloudFront | App uploads via the EC2 instance role — no S3 keys stored |
| Cron | crontab on EC2 | `/api/cron/notify-daily`, 09:00 UTC |

Pusher, PayPal and Windy are external and unchanged.

## One-time setup (already done — repeat only for a new environment)

1. **IAM** (client console): create policy from `infra/iam/terraform-deployer-policy.json`, a user with that policy, and a CLI access key.
2. **Your machine**: Terraform (`brew install hashicorp/tap/terraform`), Ansible (`pipx install --include-deps ansible`), the access key in `~/.aws/credentials` under profile `pigeonpulse`, an SSH key that can read this repo on GitHub.
3. **Infra**: in `infra/terraform`, copy `terraform.tfvars.example` → `terraform.tfvars` (bucket name, your IP as `/32`, SSH public key), then `terraform init && terraform apply`. This also writes the Ansible inventory and DB credentials.
4. **Secrets**: in `infra/ansible`, copy `group_vars/all/secrets.yml.example` → `secrets.yml`, fill from production env, then `ansible-vault encrypt` it.
5. **Data** (from Neon + R2): `ansible-playbook migrate-data.yml`. Refuses to overwrite a non-empty DB unless `-e force_restore=true`; prints a per-table row-count comparison.
6. **App**: `ansible-playbook site.yml`.

All playbook commands need `--vault-password-file ~/.config/pigeonpulse/vault-pass` (or `--ask-vault-pass`), and Terraform needs `AWS_PROFILE=pigeonpulse`.

## Everyday

```bash
# Ship latest main (pulls, rebuilds only if code or .env changed, migrations run on boot)
cd infra/ansible && ansible-playbook site.yml --vault-password-file ~/.config/pigeonpulse/vault-pass

# Logs / shell
ssh ubuntu@<public_ip>
cd /opt/pigeon_pulse && sudo docker compose logs -f app
```

Change env values in `secrets.yml` (`ansible-vault edit`) or `group_vars/all/main.yml`, never in the server's `.env` — Ansible overwrites it.

## Going live on a domain

1. DNS A record → the Elastic IP (`terraform output public_ip`). On Cloudflare use *DNS only*.
2. `infra/ansible/group_vars/all/main.yml`: `domain: pigeon-pulse.com` (default `:80` = plain HTTP on the IP).
3. `ansible-playbook site.yml` — Caddy gets the certificate itself.
4. PayPal webhook → `https://<domain>/api/payment/paypal/webhook`; mobile API URL → `https://<domain>`.

## Gotchas

- **SSH times out** → your IP changed. Update `ssh_cidrs` in `terraform.tfvars`, `terraform apply`.
- **DB URLs use `sslmode=no-verify`** — encrypted, but the RDS CA isn't in Node's trust store.
- **`NEXT_PUBLIC_*` and `R2_PUBLIC_URL` are baked in at build time** — changing them needs a rebuild (`site.yml` does this automatically when `.env` changes).
- **Build needs swap**: 2 GB RAM box; `next build` runs with a 3 GB heap backed by the 2 GB swapfile Ansible creates.
- **Empty DB can't run the migration chain** (`20260309_schema_cleanup` fails on a fresh DB). Always restore a dump first, or use `prisma db push`.
- `scripts/migrate.js` logs two harmless `P3011 … cannot be rolled back` errors on every boot.
- **Keep safe**: `~/.config/pigeonpulse/vault-pass` and `infra/terraform/terraform.tfstate` (holds the DB password). Losing either is painful.
