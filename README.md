# Self-hosted n8n on Cloudways Velocity

Deploy a self-hosted [n8n](https://n8n.io) instance on [Cloudways Velocity](https://www.cloudways.com/en/velocity.php) — managed Node.js hosting with NGINX, PM2, SSL, and Git-based deploys.

Velocity lists **n8n** as a supported framework, so you do not need Docker, Apache mod_proxy, or manual SSH installs used on classic Cloudways Flexible servers.

## What’s in this repo

| File | Purpose |
| --- | --- |
| `package.json` | Pins `n8n` and starts it on port `3000` (Velocity’s app port) |
| `package-lock.json` | Locks dependency versions for reproducible deploys |
| `.env.example` | Template for required env vars (copy to `.env`, never commit `.env`) |
| `.gitignore` | Keeps secrets, `node_modules`, and n8n data out of Git |
| `ecosystem.config.cjs` | Optional PM2 process file for SSH-based starts |

Build and start commands used by Velocity:

```bash
npm run build   # → npm install
npm start       # → N8N_PORT=3000 n8n start
```

n8n has no compile/bundle step — `build` only installs dependencies. If Velocity already runs `npm install` before your build command, you can leave **Build** empty in the dashboard instead; either approach is fine.

### Manual PM2 start (SSH)

```bash
cp .env.example .env   # then edit values
npm ci
pm2 start ecosystem.config.cjs
pm2 save
```

### Nginx must be in SSR (proxy) mode

Cloudways Velocity apps have two nginx templates:

- **CSR** — serves static files from `public_html` (wrong for n8n; empty dir → HTTP 403)
- **SSR** — `proxy_pass http://127.0.0.1:3000` (correct for n8n)

As root / Master SSH, if the public URL returns 403 while n8n is healthy on port 3000:

```bash
sudo cp -a /etc/nginx/sites-available/<app> /etc/nginx/sites-available/<app>.bak.csr
sudo cp -a /etc/nginx/node_vhosts/<app>_ssr /etc/nginx/sites-available/<app>
sudo nginx -t && sudo systemctl reload nginx
```

Replace `<app>` with your Cloudways app id (folder name under `/home/.../applications/`).

## Prerequisites

- A [Cloudways](https://platform.cloudways.com/) account with **Velocity** access
- This repository pushed to GitHub (or another Git provider Velocity can connect to)
- A domain (optional at first; Velocity provides a default URL)
- Node.js **22.x or 24.x** LTS (selectable per app in Velocity)

## 1. Push this repository

If you forked or cloned this repo locally:

```bash
git clone https://github.com/<your-user>/n8n.git
cd n8n
git remote -v   # confirm origin points at your GitHub repo
git push -u origin main
```

Velocity deploys from Git — keep `package.json` and `package-lock.json` on the branch you will connect (usually `main`).

## 2. Create a Velocity application

1. Open the Cloudways platform and go to **Velocity**.
2. Click **Get Started** / create a new application.
3. Connect your Git provider and select this repository.
4. Choose branch `main` (or your deploy branch).
5. Set framework to **n8n**.
6. Select Node.js **22.x** or **24.x**.
7. Confirm build and start commands:
   - **Build:** `npm run build` (or leave empty if Velocity already installs deps)
   - **Start:** `npm start`
8. Pick a plan size. For light automation, **Starter (2 GB RAM)** is a reasonable baseline; scale up if you run many concurrent workflows.
9. Deploy.

Velocity handles NGINX reverse proxy, PM2 process management, OS patching, and SSL for the default hostname.

## 3. Configure environment variables

In the Velocity app settings, add environment variables before relying on production workflows.

### Required / strongly recommended

| Variable | Example | Notes |
| --- | --- | --- |
| `N8N_HOST` | `n8n.example.com` | Your public hostname (no protocol) |
| `N8N_PROTOCOL` | `https` | Velocity serves HTTPS |
| `N8N_PORT` | `3000` | Already set in `npm start`; keep consistent |
| `N8N_WEBHOOK_URL` | `https://n8n.example.com/` | Must match the public URL (trailing slash) |
| `N8N_PROXY_HOPS` | `1` | Required behind Velocity’s reverse proxy |
| `N8N_ENCRYPTION_KEY` | long random string | Persist credentials across redeploys — generate once and never change |
| `GENERIC_TIMEZONE` | `America/New_York` | Workflow timezone ([tz database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)) |
| `TZ` | `America/New_York` | Same value as `GENERIC_TIMEZONE` |

Generate an encryption key:

```bash
openssl rand -hex 32
```

### Optional hardening

| Variable | Example | Notes |
| --- | --- | --- |
| `N8N_DIAGNOSTICS_ENABLED` | `false` | Disable anonymous diagnostics |
| `N8N_PERSONALIZATION_ENABLED` | `false` | Disable personalization prompts |
| `EXECUTIONS_DATA_PRUNE` | `true` | Auto-prune old execution data |
| `EXECUTIONS_DATA_MAX_AGE` | `168` | Hours to keep execution history |

After the first deploy, open the app URL and create your n8n owner account. User management is built into n8n — do not rely on legacy basic-auth env vars.

## 4. (Recommended) Attach PostgreSQL

SQLite works for quick tests but is not ideal for production. Velocity can provision **PostgreSQL**, **MySQL**, or **MongoDB** from the dashboard.

n8n recommends **PostgreSQL**. After provisioning, add:

| Variable | Example |
| --- | --- |
| `DB_TYPE` | `postgresdb` |
| `DB_POSTGRESDB_HOST` | host from Velocity DB panel |
| `DB_POSTGRESDB_PORT` | `5432` |
| `DB_POSTGRESDB_DATABASE` | your database name |
| `DB_POSTGRESDB_USER` | your database user |
| `DB_POSTGRESDB_PASSWORD` | your database password |

Redeploy (or restart) the app after saving DB variables so n8n picks them up.

> MySQL/MariaDB support in n8n is deprecated. Prefer PostgreSQL.

## 5. Custom domain and SSL

1. In Velocity, open your application → **Domains** (or equivalent).
2. Add your domain / subdomain (for example `n8n.example.com`).
3. Point DNS (A/CNAME) as instructed by Cloudways.
4. Wait for SSL provisioning.
5. Update `N8N_HOST` and `N8N_WEBHOOK_URL` to the custom domain and redeploy.

## 6. Verify the install

1. Open `https://<your-velocity-url>/` (or your custom domain).
2. Complete the n8n owner setup wizard.
3. Create a simple webhook workflow and confirm the webhook URL uses HTTPS and your hostname.
4. In Velocity logs, confirm PM2 shows the process running and listening on port `3000`.

## Updating n8n

1. Bump the version in `package.json`:

   ```json
   "dependencies": {
     "n8n": "^2.35.4"
   }
   ```

2. Refresh the lockfile locally:

   ```bash
   npm install
   git add package.json package-lock.json
   git commit -m "Bump n8n version"
   git push
   ```

3. Let Velocity auto-deploy from Git, or trigger a manual redeploy in the dashboard.

Keep `N8N_ENCRYPTION_KEY` and database credentials unchanged across upgrades so credentials and workflow data remain readable.

## Local smoke test (optional)

```bash
npm ci
npm start
# open http://localhost:3000
```

Use a different port locally if needed:

```bash
N8N_PORT=5678 npx n8n start
```

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| App won’t start | Velocity build logs; Node version ≥ 20.19 (22/24 LTS preferred); `npm ci` succeeds |
| Blank page / 502 | Process must listen on `3000`; confirm start command is `npm start` |
| Wrong webhook URLs | Set `N8N_WEBHOOK_URL`, `N8N_HOST`, `N8N_PROTOCOL=https`, `N8N_PROXY_HOPS=1` |
| Lost credentials after redeploy | `N8N_ENCRYPTION_KEY` missing or changed |
| Workflows / executions disappear | No persistent DB — provision PostgreSQL and set `DB_*` vars |
| Out of memory | Upgrade Velocity plan (more RAM) or prune executions |

## Useful links

- [Cloudways Velocity](https://www.cloudways.com/en/velocity.php)
- [n8n self-hosting docs](https://docs.n8n.io/deploy/host-n8n/)
- [n8n environment variables](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/)
- [Webhook URLs behind a reverse proxy](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/configuration-examples/configure-webhook-urls-with-reverse-proxy/)

## License

n8n is distributed under the [Sustainable Use License](https://github.com/n8n-io/n8n/blob/master/LICENSE.md) / Enterprise license terms from n8n GmbH. This repository only packages the npm dependency for Velocity deployment.
