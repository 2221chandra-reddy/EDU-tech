# Offline + Online modes

## Offline (no internet after install)

Works fully on your PC without Google Fonts, Unsplash, or YouTube:

```powershell
cd C:\Users\Uma\Desktop\hemanth
npm run setup
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:5000  
- AI: mock (built-in)  
- DB: memory  
- Videos: upload mp4 from **Admin → Content → Videos** (stored on your disk)

---

## Online (one URL for website + API)

Build the frontend, then let the API serve it:

```powershell
cd C:\Users\Uma\Desktop\hemanth
npm run setup
npm run build
```

In `backend\.env` set:

```env
NODE_ENV=production
SERVE_FRONTEND=true
CLIENT_URL=http://localhost:5000
AI_PROVIDER=mock
DB_MODE=memory
```

Then:

```powershell
npm run start:api
```

Open **http://localhost:5000** — website and API on the same port (fully online style).

### Docker (optional)

```powershell
docker compose up --build
```

Open http://localhost:5000

---

## Online production tips

| Setting | Value |
|---------|--------|
| `DB_MODE` | `postgres` + real `DATABASE_URL` |
| `AI_PROVIDER` | `openai` or `gemini` + API key |
| `JWT_SECRET` | long random string |
| `CLIENT_URL` | your public https domain |
| HTTPS | put nginx / cloud load balancer in front |

Public users open your domain; admins upload videos/textbooks; students learn and take CBT exams online.

---

## Worldwide (AWS)

See **[AWS.md](AWS.md)**. Local stays on your PC; after EC2/ECS + RDS + public HTTPS domain, anyone worldwide can open the site.
