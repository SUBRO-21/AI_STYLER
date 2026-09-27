# AI Wardrobe & Outfit Stylist (Local-First)

An AI-powered personal stylist application that runs entirely on your local machine. Upload photos of your clothes, get instant AI categorization and color harmony analysis, plan outfits based on real-time weather forecasts, and visualize try-ons.

All data (photos, database, and outfit history) is stored **privately on your own computer**.

---

## Features

- **100% Local Data Privacy**: All clothing photos are stored in `uploads/` and metadata in `wardrobe.db` (SQLite). No third-party databases.
- **AI Auto-Tagging**: Detects clothing category, sub-types, formality, and maps primary colors to Wada Sanzo color concepts (*A Dictionary of Color Combinations*).
- **Weather-Aware Outfit Planning**: Integrates Open-Meteo forecasts to recommend temperature- and condition-appropriate outfits.
- **AI Visual Try-On & Flat-Lay**: Generates preview images of outfit combinations (or virtual try-on on your portrait photo).
- **Wardrobe Status Tracking**: Quickly toggle items between `Available`, `In the Wash`, and `Damaged`.
- **Outfit History**: Track what you wore and when.
- **BYOK (Bring Your Own Key)**: Use your own free Google Gemini API key. Enter it in the UI Settings or in `.env`.

---

## Quick Start (Run Locally)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/AI_STYLER.git
cd AI_STYLER
```

### 2. Set up virtual environment & install dependencies
```bash
# Windows
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Add your Gemini API Key
Get a free API key at [Google AI Studio](https://aistudio.google.com/apikey).

Create a `.env` file from the example:
```bash
cp .env.example .env
```
And add your key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key
```
*(Alternatively, you can skip this step and paste your API key directly in the **Settings** tab within the app UI).*

### 4. Start the app
```bash
python main.py
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser!

---

## Project Structure

```
AI_STYLER/
├── main.py              # FastAPI server (API endpoints & static file serving)
├── database.py          # SQLite database connection & schema initialization
├── llm_service.py       # Gemini AI integration (tagging, styling, try-on)
├── requirements.txt     # Python dependencies
├── .env.example         # Example environment configuration
├── .gitignore           # Ignores local uploads, DB, and keys
├── static/              # Local web interface
│   ├── index.html       # HTML entry point (React 18 + Tailwind)
│   └── app.js           # Client application & UI components
└── uploads/             # (Created locally) Stores user clothing photos
```

---

## Local Data Storage & Privacy

- **Database**: SQLite database stored locally as `wardrobe.db`.
- **Images**: Uploaded clothes and try-on photos saved in `uploads/`.
- Both `wardrobe.db`, `uploads/`, and `.env` are automatically ignored by Git in `.gitignore`, keeping your personal photos, database, and API keys safe from accidental commits when pushing to GitHub.

---

## Tech Stack

- **Backend**: FastAPI, Uvicorn, Python SQLite3
- **Frontend**: React 18, Tailwind CSS, Babel Standalone (zero build step)
- **AI Models**: Google Gemini 2.5 Flash (Vision & Reasoning), Gemini 3.1 Flash Image (Virtual Try-on)
- **Weather API**: Open-Meteo (Free, no API key required)
