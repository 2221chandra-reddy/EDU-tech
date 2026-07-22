# EduGate security overview

## What was hardened

| Area | Change |
|------|--------|
| Helmet | CSP + HSTS in production; referrer-policy; no `X-Powered-By` |
| CORS | Allowlist only (`CLIENT_URL` + extras); no open “allow all” in fullstack mode |
| Rate limits | Global + stricter **auth** + **contact** + **AI** limiters |
| Passwords | Register min 8 chars, letters + numbers; bcrypt cost 12 in prod |
| JWT | Blocks weak secrets in prod; shorter default expiry in prod (`12h`) |
| Uploads | Random filenames only; stricter extension allowlist; lower size caps |
| Catalog | Unpublished materials hidden; contact validation + rate limit |
| Practice | Private practice sets require owner login |
| AI Tutor UI | HTML escaped before markdown render (XSS) |
| Health | Production response is minimal (no env/AI/db leak) |
| Memory DB | Blocked in production unless `ALLOW_MEMORY_IN_PROD=true` |

## Production checklist

1. `NODE_ENV=production`
2. Strong unique `JWT_SECRET` (32+ random chars)
3. `DB_MODE=postgres` + real `DATABASE_URL`
4. `CLIENT_URL=https://your-domain.com`
5. Change demo passwords (`admin123` / `student123`) after first deploy
6. Put HTTPS (ALB / nginx) in front of the app
7. Do not commit `.env` or real secrets

## Demo accounts (local only)

Change these before public launch:

- `admin@edugate.com` / `admin123`
- `student@edugate.com` / `student123`

## Remaining recommendations (optional next step)

- Move JWT from `localStorage` to **httpOnly Secure cookies** + CSRF protection
- Signed / auth-gated upload URLs for private files
- Full `asyncHandler` migration on every route (stop raw `err.message` in responses)
