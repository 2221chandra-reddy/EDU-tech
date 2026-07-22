# EduGate Architecture

## System overview

```
┌──────────────┐     REST/JSON      ┌──────────────────┐
│ React Client │ ◄────────────────► │ Express API      │
│ Vite + TW    │     JWT Bearer     │ Helmet + Rate    │
└──────────────┘                    └────────┬─────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    ▼                        ▼                        ▼
             PostgreSQL /              AI Provider              Disk uploads
             Memory store              OpenAI/Gemini            /uploads/*
```

## Domains

| Domain | Responsibility |
|--------|----------------|
| Auth | Register, login, JWT, roles (`student` / `admin`) |
| Catalog | Exams, courses, public materials, contact |
| Student | Dashboard, enrollments, bookmarks, results |
| Practice | Practice sets, submit, AI analysis |
| CBT | Mock start, autosave, submit, answer key |
| AI | Tutor chat, question generation, analysis |
| Admin | Content CRUD, subjects, schedules, Notebook LLM, analytics |
| Scheduler | Due exam schedules → generate paper → publish live mock |

## Security model

- Passwords hashed with bcrypt
- JWT signed with `JWT_SECRET`
- `authRequired` / `adminRequired` middleware
- Helmet HTTP headers
- Rate limiting on all API routes
- Structured operational errors (`AppError`) — no stack traces in production responses
- Upload MIME/extension filters and size limits

## Data modes

- **memory**: zero-setup local demo; data resets on process restart
- **postgres**: durable storage for staging/production (`DB_MODE=postgres`)

## Frontend structure

```
frontend/src/
  api/           HTTP client
  components/    Layout + shared UI + ErrorBoundary
  context/       Auth + Toast
  pages/         Route screens (public, student, admin, CBT)
```

## Backend structure

```
backend/src/
  config/        env + db
  middleware/    auth, upload, validate, errors, logging
  routes/        REST controllers
  services/      AI + scheduler business logic
  db/            schema, seed, memory adapter
  utils/         AppError helpers
```

## Deployment sketch

1. API process (PM2 / container) on internal port
2. Nginx terminates TLS; proxies `/api` + `/uploads`
3. Static hosting for `frontend/dist`
4. Managed Postgres + object storage (optional later for large videos)
