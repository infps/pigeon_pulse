# Deploying on AWS

Infrastructure lives in the separate **`infra`** repo — `github.com/Tatu1984/agn-terraform` (Terraform + Ansible). This page is the short version; `infra/README.md` has the full permission list.

## What runs where (us-west-2, ~$35/mo)

| Piece | AWS | Notes |
|---|---|---|
| App | EC2 `t4g.small` (Ubuntu arm64), Elastic IP | Docker Compose: `app` (image `ghcr.io/infps/pigeon_pulse`) + `caddy` (HTTPS) |
| Image build | GitHub Actions (`.github/workflows/docker-image.yml`) | Every push to `main` builds arm64 and pushes to GHCR. The server never builds |
| Database | RDS Postgres 17 `db.t4g.micro` | Private; only the EC2 security group can reach it. 7-day backups |
| Uploads | S3 bucket + CloudFront | App uploads via the EC2 instance role — no S3 keys stored |
| Cron | crontab on EC2 | `/api/cron/notify-daily`, 09:00 UTC |

Pusher, PayPal and Windy are external and unchanged.

## One-time setup (already done — repeat only for a new environment)

1. **IAM** (client console): create policy from `infra/iam/terraform-deployer-policy.json`, a user with that policy, and a CLI access key.
2. **Your machine**: Terraform (`brew install hashicorp/tap/terraform`), Ansible (`pipx install --include-deps ansible`), AWS CLI v2 + `session-manager-plugin`, your own IAM user (group `pigeonpulse-deployers`) as profile `pigeonpulse`, and your SSH public key in the infra repo's `team_ssh_keys`. Windows: use WSL.
3. **Infra**: in `infra/terraform`, copy `terraform.tfvars.example` → `terraform.tfvars`, then `terraform init && terraform apply` (state is shared in S3 — on an existing setup this reports no changes). This also writes the Ansible inventory and DB credentials locally.
4. **Secrets**: in `infra/ansible`, copy `group_vars/all/secrets.yml.example` → `secrets.yml`, fill from production env, then `ansible-vault encrypt` it.
5. **Data** (from Neon + R2): `ansible-playbook migrate-data.yml`. Refuses to overwrite a non-empty DB unless `-e force_restore=true`; prints a per-table row-count comparison.
6. **App**: `ansible-playbook site.yml`.

All playbook commands need `--vault-password-file ~/.config/pigeonpulse/vault-pass` (or `--ask-vault-pass`), and Terraform needs `AWS_PROFILE=pigeonpulse`.

## Everyday

1. Push to `main` → wait for the **Docker image** action to go green (~5 min).
2. Deploy (pulls the new image, restarts only if image or `.env` changed, migrations run on boot):

```bash
cd infra/ansible && ansible-playbook site.yml --vault-password-file ~/.config/pigeonpulse/vault-pass

# Roll back: pin an older build (every image is also tagged with its commit sha)
ansible-playbook site.yml -e app_tag=<commit-sha> --vault-password-file ~/.config/pigeonpulse/vault-pass

# Logs / shell
ssh -o ProxyCommand="aws ssm start-session --region us-west-2 --target %h --document-name AWS-StartSSHSession --parameters portNumber=%p" ubuntu@<instance-id>
cd /opt/pigeon_pulse && sudo docker compose logs -f app
```

Change env values in `secrets.yml` (`ansible-vault edit`) or `group_vars/all/main.yml`, never in the server's `.env` — Ansible overwrites it.

## Going live on a domain

1. DNS A record → the Elastic IP (`terraform output public_ip`). On Cloudflare use *DNS only*.
2. `infra/ansible/group_vars/all/main.yml`: `domain: pigeon-pulse.com` (default `:80` = plain HTTP on the IP).
3. In `.github/workflows/docker-image.yml` set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_AUTH_BASE_URL` to `https://<domain>`, push, wait for the build.
4. `ansible-playbook site.yml` — Caddy gets the certificate itself.
5. PayPal webhook → `https://<domain>/api/payment/paypal/webhook`; mobile API URL → `https://<domain>`.

## Gotchas

- **No port 22** — SSH and Ansible tunnel through AWS SSM. `Permission denied (publickey)` → your key isn't in `team_ssh_keys` yet; an existing member adds it and runs `site.yml`. Connection errors → check `AWS_PROFILE=pigeonpulse` is exported.
- **DB URLs use `sslmode=no-verify`** — encrypted, but the RDS CA isn't in Node's trust store.
- **`NEXT_PUBLIC_*` and `R2_PUBLIC_URL` are baked into the image** — they live in the workflow's `build-args`, not in the server `.env`. Change them there and let Actions rebuild.
- **Never build on the server** — `next build` needs ~1.5 GB and OOM-kills the running app on the 2 GB box. That's why images come from Actions.
- **Empty DB can't run the migration chain** (`20260309_schema_cleanup` fails on a fresh DB). Always restore a dump first, or use `prisma db push`.
- `scripts/migrate.js` logs two harmless `P3011 … cannot be rolled back` errors on every boot.
- **Keep safe**: `~/.config/pigeonpulse/vault-pass` and `infra/ansible/group_vars/all/secrets.yml` — share only via a password manager. Terraform state (holds the DB password) lives in the private, versioned bucket `pigeonpulse-tfstate-066686950435`.
