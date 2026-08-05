# Deploy EduGate on Vercel (Hobby-friendly)

## Why you saw `404 NOT_FOUND`

Vercel’s platform **NOT_FOUND** means: *no deployment/route answered that URL*.

You selected **Application Preset → Services** (frontend + backend in one project). That needs a working multi-service deploy. On **Hobby**, Express + Services often fails or never binds a public route, so opening the site shows Vercel’s **NOT_FOUND** page — not your React app.

EduGate’s API is a long-running Express app (uploads, DB, scheduler). Vercel is best for the **frontend**. Host the **backend** separately (Render / Railway / EC2).

## Fix (recommended): Frontend-only on Vercel

### 1. Delete or recreate the Vercel project
If the current project used **Services**, create a **new** project (cleaner).

### 2. Import `2221chandra-reddy/EDU-tech`

Settings:

| Setting | Value |
|--------|--------|
| Framework Preset | **Vite** (not Services) |
| Root Directory | **`frontend`** |
| Install Command | `npm install` (default — do **not** use `--prefix frontend`) |
| Build Command | `npm run build` (default) |
| Output Directory | `dist` (default) |

Important: Root Directory = `frontend` means Vercel already starts inside that folder.  
Commands like `npm install --prefix frontend` will break (`frontend/frontend/package.json`).

Leave backend out of this Vercel project.

### 3. Deploy
After deploy you get something like:

`https://edu-tech-xxxx.vercel.app`

That should show the EduGate home page (not NOT_FOUND).

### 4. Point the frontend at your API
When the backend is live (Render/etc.), set in Vercel → Environment Variables:

| Name | Value |
|------|--------|
| `VITE_API_URL` | `https://your-api.onrender.com` |

Then **Redeploy** (Vite bakes env in at build time).

Until the API is hosted, login/CBT will fail in the browser even if the UI loads — that is expected.

## Backend (separate host)

Use Render Free / Railway / your EC2 scripts in `deploy/`.

Minimum env:

```
NODE_ENV=production
JWT_SECRET=at-least-32-char-random-secret-here
DB_MODE=memory
ALLOW_MEMORY_IN_PROD=true
CLIENT_URL=https://edu-tech-xxxx.vercel.app
SERVE_FRONTEND=false
AI_PROVIDER=gemini
GEMINI_API_KEY=...
```

CORS: `CLIENT_URL` must match the Vercel URL exactly.

## Optional later

- Neon Postgres → `DB_MODE=postgres` + `DATABASE_URL`
- Custom domain on Vercel
- YouTube links for videos (cheap)

## Do not use (for now)

- Vercel **Services** preset with Express backend on Hobby
- Expecting `/api` to work from Vercel alone without a separate API host
