# Deploy guide (Vercel + Supabase + Railway)

This project is three apps:

| App | Role | Host |
|-----|------|------|
| `apps/web` | Public spin page | **Vercel** |
| `apps/admin` | Admin dashboard | **Vercel** (separate project) |
| `apps/api` | Fastify API | **Render** or **Railway** (Docker) |
| Postgres + Storage | Data / prize images | **Supabase** |

Vercel is only for the Next.js frontends. The Fastify API must run as a long-lived Node service.

---

## 0. Prerequisites

- Supabase project with schema applied (`supabase/migrations/001_initial.sql`)
- GitHub repo for this project (push the code)
- [Vercel](https://vercel.com) account
- [Render](https://render.com) account (or [Railway](https://railway.app)) for the API

---

## 1. Supabase (database + storage)

1. Open Supabase → SQL → run `supabase/migrations/001_initial.sql` if not already done.
2. Create a public Storage bucket named **`raffle-prizes`** (or match whatever your API expects).
3. Copy:
   - Project URL → `SUPABASE_URL`
   - Service role key → `SUPABASE_SERVICE_ROLE_KEY`
   - Database → Connection string → **Session pooler** → `DATABASE_URL`

---

## 2. Deploy API (Render **or** Railway)

Same Docker image (`apps/api/Dockerfile`). Prefer **Render** if Railway healthchecks are painful.

### Option A — Render (recommended alternative)

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect `sirensstudio7/raffle` → it reads `render.yaml`
3. Fill env vars when prompted (mark secret ones carefully):

```env
DATABASE_URL=postgresql://...pooler.supabase.com:5432/postgres
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=use-a-long-random-string
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=change-me
CORS_ORIGINS=https://your-web.vercel.app,https://your-admin.vercel.app
```

4. Or **New → Web Service** manually:
   - Repo: `sirensstudio7/raffle`
   - Language: **Docker**
   - Dockerfile path: `apps/api/Dockerfile`
   - Docker context: repo root (`.`) — **not** `apps/api`
   - Health check path: `/health`
5. After deploy: `https://raffle-api.onrender.com/health` → `{ "ok": true }`
6. **Note (free tier):** service sleeps after idle; first request can take ~30–60s.
7. If deploy fails with **Exited with status 1**, open the failed deploy → **Logs** and look for a red `[fatal] API failed to start:` line (that is the real error).

### Option B — Railway

1. New Project → Deploy from GitHub → select this repo.
2. Railway should pick up `railway.toml` + `apps/api/Dockerfile`.
3. Set the same env vars as above.
4. Public URL e.g. `https://raffle-api-production.up.railway.app/health`

### Seed admin (once)

From your laptop with production `DATABASE_URL` in `.env`:

```bash
npm install
npm run seed:db
```

---

## 3. Deploy public web (Vercel)

1. Vercel → Add New Project → import the GitHub repo.
2. Configure:
   - **Root Directory:** `apps/web`
   - **Framework:** Next.js
   - Install/Build: use `apps/web/vercel.json` (already set)
3. Environment variables:

```env
NEXT_PUBLIC_API_URL=https://<your-railway-api-host>
```

4. Deploy → note the URL, e.g. `https://raffle-web.vercel.app`.

---

## 4. Deploy admin (Vercel)

1. Vercel → Add New Project → **same repo again**.
2. Configure:
   - **Root Directory:** `apps/admin`
3. Environment variables:

```env
NEXT_PUBLIC_API_URL=https://<your-railway-api-host>
NEXT_PUBLIC_WEB_URL=https://raffle-web.vercel.app
```

4. Deploy → note admin URL, e.g. `https://raffle-admin.vercel.app`.

---

## 5. Lock CORS

After both Vercel URLs exist, update Railway:

```env
CORS_ORIGINS=https://raffle-web.vercel.app,https://raffle-admin.vercel.app
```

Redeploy API (or restart). Then test:

1. Open admin → login with `ADMIN_EMAIL` / `ADMIN_PASSWORD`
2. Enable spin, add prizes, activate campaign
3. Open public web → spin flow works

---

## 6. Custom domains (optional)

- Web: `spin.yourdomain.com` → Vercel web project
- Admin: `admin.yourdomain.com` → Vercel admin project
- API: `api.yourdomain.com` → Railway custom domain  
  Then update `NEXT_PUBLIC_API_URL` + `CORS_ORIGINS` accordingly.

---

## Env cheat sheet

### API (Render / Railway)

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | yes |
| `JWT_SECRET` | yes |
| `SUPABASE_URL` | yes (for images) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (for images) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | for seed |
| `CORS_ORIGINS` | yes in prod |
| `PORT` | set automatically by the host |

### Web / Admin (Vercel)

| Variable | App |
|----------|-----|
| `NEXT_PUBLIC_API_URL` | web + admin |
| `NEXT_PUBLIC_WEB_URL` | admin only |

Never put `JWT_SECRET` or Supabase service role keys in Vercel frontend projects.

---

## Local vs production

| | Local | Production |
|--|-------|------------|
| API | `npm run dev:api` | Railway Docker |
| Web | `:9980` | Vercel |
| Admin | `:9990` | Vercel |
| DB/Storage | Supabase | Same Supabase project (or separate prod project) |
