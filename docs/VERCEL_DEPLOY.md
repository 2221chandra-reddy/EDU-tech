# Vercel environment variables (Project → Settings → Environment Variables)

# Required for production boot
NODE_ENV=production
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-chars
SERVE_FRONTEND=false

# Demo without Postgres (data resets on cold starts)
DB_MODE=memory
ALLOW_MEMORY_IN_PROD=true

# After first deploy, set this to your Vercel URL (https://edu-tech-xxx.vercel.app)
CLIENT_URL=https://YOUR-PROJECT.vercel.app

# Optional AI
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-flash-latest

# Later (real DB): switch to
# DB_MODE=postgres
# DATABASE_URL=postgresql://...
# ALLOW_MEMORY_IN_PROD=false
