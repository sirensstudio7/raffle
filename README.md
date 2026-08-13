# Raffle Spin

Standalone raffle / lucky spin wheel cloned from [voicetalk](https://github.com/sirensstudio7/voice-talk). Single public spin page plus admin dashboard for campaigns, prizes, winners, and analytics.

## Stack

- `apps/api` — Fastify + Drizzle + Supabase Postgres/Storage
- `apps/web` — Next.js public spin page (port **9980**)
- `apps/admin` — Next.js admin dashboard (port **9990**)

## Setup

### 1. Supabase

1. Create a [Supabase](https://supabase.com) project
2. Run the migration SQL from [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql) in the SQL editor
3. Copy your Postgres connection string (Session pooler, port **5432** recommended) and service role key

### 2. Environment

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

Required variables:

- `DATABASE_URL` — Supabase Postgres URL
- `SUPABASE_URL` — Project URL
- `SUPABASE_SERVICE_ROLE_KEY` — For prize image uploads
- `JWT_SECRET` — Admin auth secret
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — Seeded admin login

### 3. Install & seed

```bash
npm install
npm run seed:db
```

This runs migrations and creates:

- Admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- Enabled spin wheel settings
- Demo "Launch Raffle" campaign with 5 sample prizes

### 4. Run locally

```bash
npm run dev:all
```

| App | URL |
|-----|-----|
| Public spin | http://localhost:9980 |
| Admin dashboard | http://localhost:9990/login |
| API | http://localhost:8000/health |

## Admin dashboard

After login, manage:

1. **Display** — Toggle public spin wheel on/off
2. **Campaigns** — Create/activate campaigns, auto vs manual odds
3. **Prizes** — Add prizes with images, stock, probabilities
4. **Winners** — Search winners, redeem voucher codes
5. **Analytics** — Spins, users, redemption rate, stock

## API endpoints

**Public**

- `GET /public/spin/state`
- `POST /public/spin/spin`

**Admin (JWT)**

- `POST /admin/auth/login`
- `GET/PATCH /admin/spin/settings`
- CRUD `/admin/spin/campaigns`, `/admin/spin/campaigns/:id/prizes`
- `POST /admin/spin/campaigns/:id/prizes/:id/image`
- `GET /admin/spin/winners`, `POST /admin/spin/redeem`
- `GET /admin/spin/analytics`

## Test checklist

- [ ] API health: `curl http://localhost:8000/health`
- [ ] Admin login at http://localhost:9990/login
- [ ] Enable spin wheel in Display tab
- [ ] Public page shows spin widget at http://localhost:9980
- [ ] Spin produces voucher code + win card
- [ ] Redeem voucher in Winners tab
- [ ] Upload prize image (Supabase Storage or local `/uploads` fallback)

## Deploy (Vercel + Railway + Supabase)

Frontends go on **Vercel**; the Fastify API goes on **Railway** (or similar); DB/Storage stay on **Supabase**.

See the full step-by-step guide: **[DEPLOY.md](./DEPLOY.md)**

## Notes

- Prize images use Supabase bucket `raffle-prizes` in production; local dev falls back to `apps/api/uploads/`
- Sound files (`/sounds/lucky-spin-*.mp3`) are optional — spin works without them
- One active campaign at a time; activating a new campaign ends others
