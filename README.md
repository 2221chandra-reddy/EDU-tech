# EduGate — AI Learning + CBT Examination Platform

Enterprise-ready learning ecosystem for competitive exams (RRB, SSC, Banking, UPSC, State PSC).

Students can **learn**, practice with **AI**, take **CBT mocks**, and receive **performance analysis** in one product.

---

## Offline vs Online

| Mode | How |
|------|-----|
| **Offline local** | `npm run dev` — no internet needed after install (mock AI + memory DB) |
| **Online single server** | `npm run build` then `SERVE_FRONTEND=true` + `npm run start:api` → http://localhost:5000 |

Details: [docs/OFFLINE_AND_ONLINE.md](docs/OFFLINE_AND_ONLINE.md)

---

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| Backend | Node.js + Express REST API |
| Database | PostgreSQL (production) / in-memory (local demo) |
| AI | OpenAI / Google Gemini / mock fallback |
| Security | Helmet, CORS, rate limiting, JWT auth, bcrypt |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for module flow and deployment notes.

---

## Quick start (local)

### Prerequisites
- Node.js 18+
- (Optional) Docker for PostgreSQL

### Install & run

```bash
cd hemanth
npm run setup
npm run dev
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:5173 |
| API | http://localhost:5000 |
| Health | http://localhost:5000/api/health |

### Demo accounts

| Role | Email | Password |
|------|--------|----------|
| Student | `student@edugate.com` | `student123` |
| Admin | `admin@edugate.com` | `admin123` |

---

## Environment

Copy `backend/.env.example` → `backend/.env`.

Important variables:

| Variable | Description |
|----------|-------------|
| `DB_MODE` | `memory` (default demo) or `postgres` |
| `DATABASE_URL` | Required when `DB_MODE=postgres` |
| `JWT_SECRET` | Min 32 chars in production |
| `AI_PROVIDER` | `mock` \| `openai` \| `gemini` |
| `CLIENT_URL` | Frontend origin for CORS |
| `NODE_ENV` | `development` \| `production` |

---

## Worldwide on AWS

Local `npm run dev` = **your PC only**.  
Deploy the Docker image to AWS = **anyone in the world** can open your public URL.

Full steps: **[docs/AWS.md](docs/AWS.md)** · EC2+RDS guide: **[docs/AWS_EC2_RDS.md](docs/AWS_EC2_RDS.md)** · Security: **[docs/SECURITY.md](docs/SECURITY.md)**

Quick idea: EC2 or ECS + RDS Postgres + set:

```env
NODE_ENV=production
HOST=0.0.0.0
SERVE_FRONTEND=true
CLIENT_URL=https://YOUR_DOMAIN.com
DB_MODE=postgres
DATABASE_URL=postgresql://...
JWT_SECRET=long-random-secret-32chars-minimum
```

---

## Production checklist

1. Set `NODE_ENV=production` and `HOST=0.0.0.0`
2. Set a strong `JWT_SECRET` (32+ characters)
3. Use `DB_MODE=postgres` with AWS RDS
4. Run schema SQL (`backend/src/db/schema.sql`) and seed carefully
5. Set real `OPENAI_API_KEY` or `GEMINI_API_KEY`
6. Build + run Docker, or `npm run build` then `SERVE_FRONTEND=true`
7. Put HTTPS (ALB / CloudFront) in front; set `CLIENT_URL` to your domain
8. Change default demo passwords before public launch

---

## Admin capabilities

- Subjects: add / delete
- Materials & videos: upload, update, delete (left panel in Content)
- Notebook LLM: generate mock papers from content directions
- Exam calendar: schedule papers with subject % pattern → auto-publish to students
- Question bank, analytics, results

---

## Scripts

```bash
npm run setup          # install backend + frontend deps
npm run dev            # API + web together
npm run dev:backend
npm run dev:frontend
npm run build          # production frontend build
npm run db:up          # docker postgres
npm run db:init
npm run db:seed
```

---

## License

Private / project use — EduGate.
