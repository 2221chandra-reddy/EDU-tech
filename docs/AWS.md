# Deploy EduGate worldwide on AWS

Local `npm run dev` stays on **your PC only**.  
After you put this app on AWS with a public URL, **anyone in the world** can open it.

---

## What you need on AWS

| Piece | Suggested AWS service |
|-------|------------------------|
| App (website + API) | **EC2** or **ECS/Fargate** or **App Runner** |
| Database | **RDS PostgreSQL** |
| Files (videos/docs) | **EBS** on EC2, or later **S3** |
| HTTPS domain | **Route 53** + **ACM** + **ALB** (or CloudFront) |
| Secrets | **Systems Manager Parameter Store** or **Secrets Manager** |

Easiest path for first launch: **RDS + EC2 + Docker**.

**Full click-by-click guide:** [AWS_EC2_RDS.md](AWS_EC2_RDS.md)

| Script | Purpose |
|--------|---------|
| `deploy/ec2-setup.sh` | Install Docker on Ubuntu / Amazon Linux |
| `deploy/init-db-on-ec2.sh` | Run `schema.sql` + seed on RDS |
| `deploy/run-edugate.sh` | Build image & run on port 80 |
| `deploy/env.production.example` | Copy → `deploy/.env.production` |

---

## Production environment (set these on AWS)

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=5000
SERVE_FRONTEND=true
CLIENT_URL=https://YOUR_DOMAIN.com
JWT_SECRET=use-a-long-random-secret-at-least-32-characters
DB_MODE=postgres
DATABASE_URL=postgresql://USER:PASSWORD@YOUR_RDS_ENDPOINT:5432/edugate
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

- `HOST=0.0.0.0` is required so AWS can route public traffic into the container.
- `CLIENT_URL` must be your real public `https://` URL.
- Use **RDS** for real users (do not use `DB_MODE=memory` in production).

Run the SQL in `backend/src/db/schema.sql` once on the new RDS database (and seed if you want demo accounts).

---

## Option A — EC2 + Docker (simple)

1. Launch an **Amazon Linux / Ubuntu** EC2 instance.
2. Security group: allow **inbound 80, 443**, and **22** (SSH) for you only.
3. Install Docker on the instance.
4. Copy this project (or pull from Git) onto the instance.
5. Build and run:

```bash
docker build -t edugate .
docker run -d --name edugate -p 80:5000 \
  -e NODE_ENV=production \
  -e HOST=0.0.0.0 \
  -e SERVE_FRONTEND=true \
  -e CLIENT_URL=https://YOUR_DOMAIN.com \
  -e JWT_SECRET='your-long-secret' \
  -e DB_MODE=postgres \
  -e DATABASE_URL='postgresql://...' \
  -e AI_PROVIDER=openai \
  -e OPENAI_API_KEY='...' \
  -v edugate_uploads:/app/backend/uploads \
  edugate
```

6. Point your domain / ALB to the EC2 public IP.
7. Open `https://YOUR_DOMAIN.com` from any country.

Health check URL for ALB: `GET /api/health`

---

## Option B — ECS / App Runner

1. Build the same `Dockerfile` and push to **ECR**.
2. Create an ECS service or App Runner service from that image.
3. Set the same environment variables as above.
4. Attach a public load balancer / HTTPS.
5. Point the domain to the service URL.

---

## Checklist before going live

- [ ] `NODE_ENV=production`
- [ ] Strong `JWT_SECRET` (32+ chars)
- [ ] `DB_MODE=postgres` + RDS `DATABASE_URL`
- [ ] `CLIENT_URL=https://your-real-domain`
- [ ] `SERVE_FRONTEND=true` (one URL for site + API)
- [ ] Security group / firewall only opens 80/443 publicly
- [ ] Change default demo passwords (`admin123` / `student123`)
- [ ] Real AI key if you want live AI (not `mock`)

---

## Local vs worldwide

| Where | Who can open |
|-------|----------------|
| `npm run dev` on your PC | Only you (`localhost`) |
| Docker/AWS with public IP or domain | Anyone worldwide |
