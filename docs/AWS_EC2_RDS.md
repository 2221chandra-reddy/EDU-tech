# EduGate on AWS — RDS PostgreSQL + EC2 + Docker

Step-by-step: create the database, create the server, install Docker, run EduGate so anyone can open it worldwide.

---

## Overview

```text
Internet → EC2 (port 80/443) → Docker EduGate (API + website)
                ↓
         RDS PostgreSQL (edugate)
```

| Step | What you create |
|------|-----------------|
| 1 | **RDS** PostgreSQL database named `edugate` |
| 2 | **EC2** Ubuntu/Amazon Linux with Docker |
| 3 | Run schema SQL + start the app container |

This project already has a root `Dockerfile` for one-container deploy (frontend + API).

---

## Part 1 — Create RDS (PostgreSQL)

### 1.1 Open RDS
1. Sign in to [AWS Console](https://console.aws.amazon.com/)
2. Region: pick one near you (e.g. `ap-south-1` Mumbai)
3. Search **RDS** → **Create database**

### 1.2 Engine settings
| Setting | Value |
|---------|--------|
| Method | Standard create |
| Engine | **PostgreSQL** |
| Version | 15 or 16 (default is fine) |
| Templates | **Free tier** (learning) or Production |

### 1.3 Credentials
| Setting | Value |
|---------|--------|
| DB instance identifier | `edugate-db` |
| Master username | `edugate` (or `postgres`) |
| Master password | **strong password** — save it |

### 1.4 Instance & storage
- Free tier: `db.t3.micro` / `db.t4g.micro`
- Storage: 20 GB gp3 is enough to start

### 1.5 Connectivity (important)
| Setting | Value |
|---------|--------|
| VPC | Default VPC (or same VPC as EC2 later) |
| Public access | **Yes** only if you will run `db:init` from your PC; for production prefer **No** and connect from EC2 only |
| VPC security group | Create new: `edugate-rds-sg` |
| Availability Zone | No preference |

Later, allow inbound **TCP 5432** on `edugate-rds-sg` **from the EC2 security group** (not `0.0.0.0/0` if you can avoid it).

### 1.6 Additional configuration
| Setting | Value |
|---------|--------|
| Initial database name | **`edugate`** |
| Backup | Enable (7 days) for production |

Click **Create database**. Wait until Status = **Available**.

### 1.7 Copy connection info
On the RDS instance page, note:

```text
Endpoint:  edugate-db.xxxxx.ap-south-1.rds.amazonaws.com
Port:      5432
DB name:   edugate
User:      edugate
Password:  (the one you saved)
```

Build your URL:

```text
DATABASE_URL=postgresql://edugate:YOUR_PASSWORD@edugate-db.xxxxx.ap-south-1.rds.amazonaws.com:5432/edugate
```

URL-encode special characters in the password (`@` → `%40`, `#` → `%23`, etc.).

### 1.8 Run schema once

**Option A — from your PC** (RDS must allow your IP on port 5432):

```powershell
cd C:\Users\Uma\Desktop\hemanth\backend
copy .env.example .env.aws
# Edit .env.aws:
#   DB_MODE=postgres
#   DATABASE_URL=postgresql://...
#   NODE_ENV=development
#   JWT_SECRET=any-long-dev-secret-for-init-only-32chars

# Temporarily use that env for init:
$env:DB_MODE="postgres"
$env:DATABASE_URL="postgresql://edugate:PASSWORD@ENDPOINT:5432/edugate"
$env:JWT_SECRET="edugate-init-secret-change-me-32chars-min"
npm run db:init
npm run db:seed
```

**Option B — from EC2** (after Part 2), using the helper script:

```bash
cd ~/edugate
./deploy/init-db-on-ec2.sh
```

Schema file used: `backend/src/db/schema.sql`.

---

## Part 2 — Create EC2 (server)

### 2.1 Launch instance
1. AWS Console → **EC2** → **Launch instance**
2. Name: `edugate-app`
3. AMI: **Ubuntu Server 22.04 LTS** (or Amazon Linux 2023)
4. Instance type: `t3.small` (or `t3.micro` for tiny demo)
5. Key pair: create/download `.pem` — keep it safe

### 2.2 Network / security group
Create security group `edugate-ec2-sg`:

| Type | Port | Source | Why |
|------|------|--------|-----|
| SSH | **22** | **My IP** only | Admin login |
| HTTP | **80** | Anywhere `0.0.0.0/0` | Website |
| HTTPS | **443** | Anywhere `0.0.0.0/0` | Later with SSL |

### 2.3 Storage
- 20–30 GB gp3

Launch the instance. Note the **Public IPv4 address**.

### 2.4 Allow EC2 → RDS
1. Open RDS security group `edugate-rds-sg`
2. Inbound rule: **PostgreSQL 5432**
3. Source: security group **`edugate-ec2-sg`** (not the whole internet)

### 2.5 SSH into EC2

**Ubuntu (Windows PowerShell):**

```powershell
ssh -i "C:\path\to\your-key.pem" ubuntu@EC2_PUBLIC_IP
```

**Amazon Linux:**

```powershell
ssh -i "C:\path\to\your-key.pem" ec2-user@EC2_PUBLIC_IP
```

---

## Part 3 — Install Docker on EC2

On the EC2 shell:

```bash
# Upload or clone the project first, then:
cd ~/edugate   # or wherever the repo is
chmod +x deploy/ec2-setup.sh
./deploy/ec2-setup.sh
```

Or manually (Ubuntu):

```bash
sudo apt-get update -y
sudo apt-get install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# log out and SSH again so docker works without sudo
```

---

## Part 4 — Put EduGate on the server

### 4.1 Copy project to EC2

From your PC (PowerShell):

```powershell
scp -i "C:\path\to\your-key.pem" -r C:\Users\Uma\Desktop\hemanth ubuntu@EC2_PUBLIC_IP:~/edugate
```

Or push to GitHub and on EC2:

```bash
git clone https://github.com/YOUR_USER/edugate.git ~/edugate
cd ~/edugate
```

### 4.2 Create production env file

```bash
cd ~/edugate
cp deploy/env.production.example deploy/.env.production
nano deploy/.env.production
```

Fill in:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=5000
SERVE_FRONTEND=true
CLIENT_URL=http://EC2_PUBLIC_IP
JWT_SECRET=paste-a-long-random-secret-at-least-32-characters
DB_MODE=postgres
DATABASE_URL=postgresql://edugate:PASSWORD@RDS_ENDPOINT:5432/edugate
AI_PROVIDER=mock
```

Later change `CLIENT_URL` to `https://your-domain.com`.

### 4.3 Init DB (if not done from PC)

```bash
chmod +x deploy/init-db-on-ec2.sh deploy/run-edugate.sh
./deploy/init-db-on-ec2.sh
```

### 4.4 Build and run

```bash
./deploy/run-edugate.sh
```

This builds the Docker image and runs:

- Host port **80** → container port **5000**
- Website + API on the same URL

### 4.5 Test

```bash
curl http://127.0.0.1/api/health
```

From your browser: `http://EC2_PUBLIC_IP`

Login (after seed):

- Admin: `admin@edugate.com` / `admin123` → **change immediately**
- Student: `student@edugate.com` / `student123`

---

## Useful Docker commands on EC2

```bash
docker ps
docker logs -f edugate
docker restart edugate
docker stop edugate && docker rm edugate
# rebuild after code change:
./deploy/run-edugate.sh
```

---

## HTTPS (recommended next)

1. Get a domain (Route 53 or any registrar)
2. Point A record to EC2 public IP
3. Put **ALB + ACM certificate**, or install **Caddy/nginx** with Let’s Encrypt on EC2
4. Set `CLIENT_URL=https://your-domain.com` and recreate the container

Health check path for load balancer: `/api/health`

---

## Checklist

- [ ] RDS created, DB name `edugate`
- [ ] Schema + seed applied
- [ ] EC2 running, SG: 22 (your IP), 80/443 public
- [ ] RDS SG allows 5432 from EC2 SG
- [ ] Docker installed
- [ ] `deploy/.env.production` filled
- [ ] Container running on port 80
- [ ] `/api/health` returns ok
- [ ] Demo passwords changed

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Can’t connect to RDS from EC2 | Check RDS SG allows EC2 SG on 5432; same VPC |
| `JWT_SECRET` too weak | Use 32+ random characters |
| Memory DB error in production | Set `DB_MODE=postgres` + real `DATABASE_URL` |
| Site loads but API CORS errors | Set `CLIENT_URL` to the exact URL you open in the browser |
| Docker permission denied | Re-SSH after `usermod -aG docker` |
| Port 80 in use | `sudo lsof -i :80` or stop other web servers |

Scripts live in the `deploy/` folder next to this guide.
