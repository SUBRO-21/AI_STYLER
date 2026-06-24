# AI Stylist

A wardrobe styling app powered by Gemini vision AI. Upload clothes, get AI-tagged descriptions, plan outfits for events with real weather data, and generate flat-lay previews.

## Local development

```bash
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt  # Windows
# pip install -r requirements.txt               # Mac/Linux

cp .env.example .env
# Edit .env — add your GEMINI_API_KEY

.\venv\Scripts\uvicorn main:app --reload        # Windows
# uvicorn main:app --reload                     # Mac/Linux
```

Open http://localhost:8000

---

## Deployment checklist

### 1. Supabase (PostgreSQL database)

- [ ] Create project at https://supabase.com/dashboard
- [ ] Copy the **Connection String** from Project Settings → Database → Connection string → URI
- [ ] It looks like: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

### 2. Cloudinary (image storage)

- [ ] Create free account at https://cloudinary.com
- [ ] From the Dashboard, copy the **API Environment variable** — it looks like:
  `cloudinary://api_key:api_secret@cloud_name`

### 3. Render (backend)

- [ ] Push this repo to GitHub
- [ ] Create a new **Web Service** at https://render.com
- [ ] Connect your GitHub repo
- [ ] Set **Build Command**: `pip install -r requirements.txt`
- [ ] Set **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- [ ] Add environment variables:
  - `GEMINI_API_KEY` = your key from https://aistudio.google.com/apikey
  - `DATABASE_URL` = Supabase connection string (from step 1)
  - `CLOUDINARY_URL` = Cloudinary env var (from step 2)
  - `CORS_ORIGINS` = `https://YOUR_APP.vercel.app` (fill in after Vercel deploy)
- [ ] Note your Render URL: `https://YOUR_APP.onrender.com`

### 4. Vercel (frontend)

- [ ] Edit `vercel.json` — replace `YOUR_RENDER_APP` with your actual Render subdomain
- [ ] Push the change to GitHub
- [ ] Import your GitHub repo at https://vercel.com/new
- [ ] Framework preset: **Other**
- [ ] Output directory: `static`
- [ ] Deploy — no build command needed
- [ ] Copy your Vercel URL and paste it into Render's `CORS_ORIGINS` env var

### 5. Final smoke test

- [ ] Visit your Vercel URL → app loads
- [ ] Upload a photo → AI tags appear
- [ ] Plan an outfit → weather + outfits load
- [ ] "I wore this" → appears in History tab

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Free at aistudio.google.com |
| `DATABASE_URL` | No | Supabase PostgreSQL URI. Omit to use local SQLite. |
| `CLOUDINARY_URL` | No | Cloudinary env string. Omit to store uploads locally. |
| `CORS_ORIGINS` | No | Comma-separated origins. Defaults to `*`. |

## Tech stack

- **Backend**: FastAPI + SQLite (local) / PostgreSQL (production)
- **Frontend**: React 18 via CDN + Babel Standalone + Tailwind CSS
- **AI**: `gemini-2.5-flash` for vision tagging & outfit generation; `gemini-3.1-flash-image` for flat-lay previews
- **Weather**: Open-Meteo (free, no API key)
- **Color system**: Wada Sanzo's *Dictionary of Color Combinations*
