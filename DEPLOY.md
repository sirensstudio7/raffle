# Deploy guide (Vercel + Supabase + Railway)

This project is three apps:

| App | Role | Host |
|-----|------|------|
| `apps/web` | Public spin page | **Vercel** |
| `apps/admin` | Admin dashboard | **Vercel** (separate project) |
| `apps/api` | Fastify API | **Railway** (or Render/Fly) |
| Postgres + Storage | Data / prize images | **Supabase** |

Vercel is only for the Next.js frontends. The Fastify API must run as a long-lived Node service.

---

## 0. Prerequisites

- Supabase project with schema applied (`supabase/migrations/001_initial.sql`)
- GitHub repo for this project (push the code)
- [Vercel](https://vercel.com) account
- [Railway](https://railway.app) account (recommended for API)

---

## 1. Supabase (database + storage)

1. Open Supabase → SQL → run `supabase/migrations/001_initial.sql` if not already done.
2. Create a public Storage bucket named **`raffle-prizes`** (or match whatever your API expects).
3. Copy:
   - Project URL → `SUPABASE_URL`
   - Service role key → `SUPABASE_SERVICE_ROLE_KEY`
   - Database → Connection string → **Session pooler** → `DATABASE_URL`

---

## 2. Deploy API (Railway)

1. New Project → Deploy from GitHub → select this repo.
2. Railway should pick up `railway.toml` + `apps/api/Dockerfile`.
3. Set **Variables**:

```env
DATABASE_URL=postgresql://...pooler.supabase.com:5432/postgres
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=use-a-long-random-string
JWT_EXPIRE_HOURS=168
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=change-me
ADMIN_NAME=Admin
CORS_ORIGINS=https://your-web.vercel.app,https://your-admin.vercel.app
```

4. Generate a public domain (e.g. `https://raffle-api-production.up.railway.app`).
5. Hit `https://<api-host>/health` → `{ "ok": true }`.
6. Seed admin once (from your laptop with the same `DATABASE_URL`):

```bash
npm install
npm run seed:db
```

Or run `npm run seed --workspace=api` against production `DATABASE_URL` only if schema is already applied.

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

### API (Railway)

| Variable | Required |
|----------|----------|
| `DATABASE_URL` | yes |
| `JWT_SECRET` | yes |
| `SUPABASE_URL` | yes (for images) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (for images) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | for seed |
| `CORS_ORIGINS` | yes in prod |
| `PORT` | set by Railway automatically |

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
