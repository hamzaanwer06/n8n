# Self-hosted n8n on Cloudways Velocity

A ready-to-fork starter for running **[n8n](https://n8n.io)** on **[Cloudways Velocity](https://www.cloudways.com/en/velocity.php)** (managed Node.js hosting).

It pins n8n as an npm dependency, starts on Velocity’s app port **3000**, and documents the env vars, PM2, and nginx **SSR** proxy setup you need for a working public HTTPS URL.

> **Fork this repo** → connect it to a Velocity app (or install over SSH) → open the URL → create your n8n owner account.

No Docker required. Velocity already provides NGINX, TLS, and process management.

---

## What’s included

| File | Purpose |
| --- | --- |
| `package.json` | Pins `n8n` and starts with `N8N_PORT=3000` |
| `package-lock.json` | Reproducible installs |
| `.env.example` | Env template — copy to `.env`, **never commit `.env`** |
| `.gitignore` | Ignores secrets, `node_modules`, and n8n data |
| `ecosystem.config.cjs` | Optional PM2 config for SSH-based starts |
| `README.md` | This guide |

**Scripts**

```bash
npm run build   # → npm install
npm start       # → N8N_PORT=3000 n8n start
```

n8n has no compile step — `build` only installs dependencies.

---

## Prerequisites

- Cloudways account with **Velocity** (Node.js) access  
- This repo forked or cloned to your GitHub account  
- Node.js **22.x** or **24.x** LTS (selectable per Velocity app)  
- ~**2 GB RAM** minimum for light learning use (n8n is memory-heavy)

---

## Quick start (Velocity dashboard)

### 1. Fork / clone

```bash
git clone https://github.com/hamzaanwer06/n8n.git
cd n8n
```

Or click **Fork** on GitHub and use your fork.

### 2. Create a Velocity application

1. Open [Cloudways Platform](https://platform.cloudways.com/) → **Velocity**
2. Create an application and connect your GitHub repo / branch (`main`)
3. Framework: **n8n** (or Node.js)
4. Node version: **22** or **24**
5. Commands:
   - **Build:** `npm run build` *(or leave empty if Velocity already runs `npm install`)*
   - **Start:** `npm start`
6. Deploy

Velocity provisions a default hostname like:

`https://nodejs-XXXXXX-XXXXXXX.cloudwaysnodeapps.com`

### 3. Set environment variables

In the Velocity app → **Environment Variables** (or a `.env` in `private_html` for SSH installs), set at least:

| Variable | Example | Notes |
| --- | --- | --- |
| `N8N_HOST` | `nodejs-….cloudwaysnodeapps.com` | Hostname only — **no** `https://` |
| `N8N_PROTOCOL` | `https` | Velocity terminates TLS |
| `N8N_PORT` | `3000` | Must match Velocity’s app port |
| `N8N_LISTEN_ADDRESS` | `127.0.0.1` | nginx proxies locally |
| `N8N_WEBHOOK_URL` | `https://nodejs-….cloudwaysnodeapps.com/` | Full public URL, trailing `/` |
| `N8N_PROXY_HOPS` | `1` | Required behind nginx |
| `N8N_ENCRYPTION_KEY` | *(see below)* | **Generate once; never change** |
| `GENERIC_TIMEZONE` | `UTC` | Or your tz database name |
| `TZ` | `UTC` | Same as `GENERIC_TIMEZONE` |

Generate the encryption key:

```bash
openssl rand -hex 32
```

Optional (recommended on small plans):

| Variable | Suggested |
| --- | --- |
| `N8N_DIAGNOSTICS_ENABLED` | `false` |
| `N8N_PERSONALIZATION_ENABLED` | `false` |
| `EXECUTIONS_DATA_PRUNE` | `true` |
| `EXECUTIONS_DATA_MAX_AGE` | `168` |
| `NODE_OPTIONS` | `--max-old-space-size=768` |

See `.env.example` for a full template.

Redeploy / restart after saving env vars.

### 4. Open n8n and create the owner account

1. Visit your Velocity HTTPS URL  
2. Complete the **owner setup** wizard (email + password)  
3. Build a tiny workflow (Manual Trigger → Set) and execute it  

User management is built into n8n — do not rely on legacy basic-auth env vars.

---

## Alternative: install over SSH + PM2

Useful for learning or when you prefer not to wait on a Git deploy.

```bash
cd /path/to/private_html   # or your clone of this repo
cp .env.example .env
# Edit .env — set N8N_HOST, N8N_WEBHOOK_URL, N8N_ENCRYPTION_KEY, etc.

export PATH=/opt/node/24/bin:$PATH   # or Node 22 — match Velocity
npm ci
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/healthz
# expect 200
```

### Nginx must be in SSR (proxy) mode

Velocity apps have two nginx templates:

| Mode | Behavior | For n8n? |
| --- | --- | --- |
| **CSR** | Serves static files from `public_html` | No — empty dir → **HTTP 403** |
| **SSR** | `proxy_pass http://127.0.0.1:3000` | **Yes** |

If n8n is healthy on port 3000 but the public URL returns **403**, switch to SSR as **Master / root** SSH:

```bash
# Replace <app> with your Cloudways app id
# (folder name under /home/.../applications/ or .../cloudwaysapps.com/)

sudo cp -a /etc/nginx/sites-available/<app> /etc/nginx/sites-available/<app>.bak.csr
sudo cp -a /etc/nginx/node_vhosts/<app>_ssr /etc/nginx/sites-available/<app>
sudo nginx -t && sudo systemctl reload nginx

curl -sS -o /dev/null -w "public=%{http_code}\n" https://YOUR_HOSTNAME/
# expect 200
```

> A 403 in the **same second** as `reload` can be a stale worker. Retry once after a few seconds.

---

## (Recommended) PostgreSQL for real use

SQLite is fine for first-day learning. For anything longer-lived, provision **PostgreSQL** in Velocity and add:

| Variable | Value |
| --- | --- |
| `DB_TYPE` | `postgresdb` |
| `DB_POSTGRESDB_HOST` | from Velocity DB panel |
| `DB_POSTGRESDB_PORT` | `5432` |
| `DB_POSTGRESDB_DATABASE` | your DB name |
| `DB_POSTGRESDB_USER` | your DB user |
| `DB_POSTGRESDB_PASSWORD` | your DB password |

Restart/redeploy after saving. Prefer PostgreSQL — MySQL/MariaDB support in n8n is deprecated.

---

## Custom domain

1. Velocity app → **Domains** → add `n8n.example.com`  
2. Point DNS as Cloudways instructs  
3. Wait for SSL  
4. Update `N8N_HOST` and `N8N_WEBHOOK_URL`, then restart  

---

## Updating n8n

1. Bump the version in `package.json`:

   ```json
   "dependencies": {
     "n8n": "^2.35.4"
   }
   ```

2. Refresh the lockfile and push:

   ```bash
   npm install
   git add package.json package-lock.json
   git commit -m "Bump n8n version"
   git push
   ```

3. Redeploy in Velocity (or `npm ci` + `pm2 restart n8n` over SSH).

**Keep `N8N_ENCRYPTION_KEY` and DB credentials unchanged** across upgrades, or saved credentials become unreadable.

---

## Local smoke test (optional)

```bash
cp .env.example .env
# For local use, set N8N_HOST=localhost N8N_PROTOCOL=http N8N_PORT=5678 etc.
npm ci
N8N_PORT=5678 npx n8n start
# open http://localhost:5678
```

---

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| App won’t start | Build logs; Node ≥ 20.19 (22/24 preferred); `npm ci` succeeds |
| Public URL **403**, local `:3000` is **200** | nginx still on **CSR** — switch to **SSR** (commands above) |
| Blank page / **502** | Process must listen on `127.0.0.1:3000`; confirm `npm start` / PM2 |
| Wrong webhook URLs | `N8N_WEBHOOK_URL`, `N8N_HOST`, `N8N_PROTOCOL=https`, `N8N_PROXY_HOPS=1` |
| Lost credentials after redeploy | `N8N_ENCRYPTION_KEY` missing or changed |
| Workflows / executions vanish | Still on SQLite with wiped disk — use PostgreSQL |
| Out of memory / restarts | Upgrade plan RAM, set `NODE_OPTIONS=--max-old-space-size=768`, prune executions |
| Git push auth failed | Use a **Personal Access Token** as the password — GitHub rejects account passwords |

**Quick health checks**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/healthz
curl -sS -o /dev/null -w "%{http_code}\n" https://YOUR_HOSTNAME/healthz
pm2 status
pm2 logs n8n --lines 50
```

---

## Security notes

- **Never commit** `.env`, encryption keys, or database passwords  
- Rotate any GitHub token that was ever embedded in a git remote URL  
- Treat `N8N_ENCRYPTION_KEY` like a master secret — back it up offline  

---

## Useful links

- [Cloudways Velocity](https://www.cloudways.com/en/velocity.php)  
- [n8n self-hosting docs](https://docs.n8n.io/deploy/host-n8n/)  
- [n8n environment variables](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/)  
- [Webhooks behind a reverse proxy](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/configuration-examples/configure-webhook-urls-with-reverse-proxy/)  

---

## License

[n8n](https://github.com/n8n-io/n8n) is distributed under the [Sustainable Use License](https://github.com/n8n-io/n8n/blob/master/LICENSE.md) / Enterprise terms from n8n GmbH.

This repository only packages the npm dependency and deployment helpers for Cloudways Velocity. It does not grant rights beyond n8n’s own license.
