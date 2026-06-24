import os
import json
import shutil
import traceback
import requests
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

import database
import llm_service

app = FastAPI()

cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
database.init_db()

P = database.P   # SQL placeholder (? for SQLite, %s for PostgreSQL)


# ── Cloudinary helper ─────────────────────────────────────────────────────────

def save_upload(local_path: str, filename: str) -> str:
    """Upload to Cloudinary if configured, else return local path."""
    cloudinary_url = os.getenv("CLOUDINARY_URL")
    if cloudinary_url:
        import cloudinary, cloudinary.uploader
        cloudinary.config(cloudinary_url=cloudinary_url)
        result = cloudinary.uploader.upload(local_path, public_id=f"wardrobe/{filename}")
        return result["secure_url"]
    return local_path


# ── Pydantic models ───────────────────────────────────────────────────────────

class ItemCreate(BaseModel):
    image_path: str
    category: str
    sub_type: Optional[str] = None
    color: str
    formality: str
    description: str

class AvailabilityUpdate(BaseModel):
    availability: str   # 'available' | 'washing' | 'damaged'

class EventInput(BaseModel):
    description: str
    date: str
    location: str

class OutfitGenerationRequest(BaseModel):
    event: str
    weather: dict

class FeedbackRequest(BaseModel):
    outfit_items: str
    weather_fit: str
    event_fit: str
    overall_note: str
    feedback_type: str
    feedback_text: Optional[str] = None

class OutfitHistoryCreate(BaseModel):
    item_ids: str           # JSON string of item ID array
    event_description: str
    date: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    safe_name = os.path.basename(file.filename)
    local_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(local_path, "wb") as buf:
        shutil.copyfileobj(file.file, buf)

    try:
        tags = llm_service.analyze_image_for_tags(local_path)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=422, detail=f"Image analysis failed: {e}")

    image_path = save_upload(local_path, safe_name)
    return {"image_path": image_path, "tags": tags}


@app.post("/api/items")
def create_item(item: ItemCreate):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    if database.DATABASE_URL:
        cursor.execute(
            f'INSERT INTO items (image_path,category,sub_type,color,formality,description) '
            f'VALUES ({P},{P},{P},{P},{P},{P}) RETURNING id',
            (item.image_path, item.category, item.sub_type,
             item.color, item.formality, item.description)
        )
        item_id = cursor.fetchone()['id']
    else:
        cursor.execute(
            f'INSERT INTO items (image_path,category,sub_type,color,formality,description) '
            f'VALUES ({P},{P},{P},{P},{P},{P})',
            (item.image_path, item.category, item.sub_type,
             item.color, item.formality, item.description)
        )
        item_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": item_id, "status": "success"}


@app.get("/api/items")
def get_items():
    conn = database.get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM items ORDER BY created_at DESC')
    items = [dict(row) for row in cursor.fetchall()]

    cursor.execute('SELECT item_ids, created_at FROM outfit_history ORDER BY created_at DESC')
    history_rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    # Build last_worn map: item_id → most recent date worn
    last_worn: dict = {}
    for row in history_rows:
        try:
            for iid in json.loads(row['item_ids']):
                if iid not in last_worn:
                    last_worn[iid] = row['created_at']
        except Exception:
            pass

    for item in items:
        item['last_worn'] = last_worn.get(item['id'])
    return items


@app.patch("/api/items/{item_id}/availability")
def update_availability(item_id: int, update: AvailabilityUpdate):
    if update.availability not in ('available', 'washing', 'damaged'):
        raise HTTPException(status_code=400, detail="availability must be 'available', 'washing', or 'damaged'")
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        f'UPDATE items SET availability={P}, availability_updated_at=CURRENT_TIMESTAMP WHERE id={P}',
        (update.availability, item_id)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}


@app.post("/api/weather")
def get_weather(event: EventInput):
    geocode_url = (
        f"https://geocoding-api.open-meteo.com/v1/search"
        f"?name={quote(event.location)}&count=1&format=json"
    )
    try:
        geo_res = requests.get(geocode_url, timeout=10).json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Geocoding unavailable: {e}")

    if not geo_res.get("results"):
        raise HTTPException(status_code=404, detail=f"Location not found: '{event.location}'")

    lat = geo_res["results"][0]["latitude"]
    lon = geo_res["results"][0]["longitude"]

    weather_url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode"
        f"&timezone=auto"
    )
    try:
        weather_res = requests.get(weather_url, timeout=10).json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Weather service unavailable: {e}")

    daily = weather_res.get("daily", {})
    if not daily:
        raise HTTPException(status_code=500, detail="Weather data unavailable")

    return {
        "temp_max": daily.get("temperature_2m_max", [None])[0],
        "temp_min": daily.get("temperature_2m_min", [None])[0],
        "precip_chance": daily.get("precipitation_probability_max", [None])[0],
        "conditions_code": daily.get("weathercode", [None])[0],
    }


@app.post("/api/generate")
def generate_outfit(req: OutfitGenerationRequest):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT id,category,sub_type,color,formality,description,image_path "
        f"FROM items WHERE availability={P}",
        ('available',)
    )
    available_items = [dict(row) for row in cursor.fetchall()]
    conn.close()

    outfits = llm_service.generate_outfits(available_items, req.event, req.weather)
    if not outfits:
        return {"outfits": []}

    items_map = {item['id']: item for item in available_items}

    # Generate flat-lay images in parallel (Nano Banana / gemini-3.1-flash-image)
    def gen_image(outfit):
        paths = [
            items_map[iid]['image_path']
            for iid in outfit.get('item_ids', [])
            if iid in items_map
        ]
        return llm_service.generate_outfit_image(paths, req.event)

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(gen_image, outfit): i for i, outfit in enumerate(outfits)}
        for future in as_completed(futures):
            idx = futures[future]
            try:
                outfits[idx]['outfit_image'] = future.result(timeout=60)
            except Exception:
                outfits[idx]['outfit_image'] = None

    return {"outfits": outfits}


@app.post("/api/feedback")
def save_feedback(req: FeedbackRequest):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        f'INSERT INTO feedback (outfit_items,weather_fit,event_fit,overall_note,feedback_type,feedback_text) '
        f'VALUES ({P},{P},{P},{P},{P},{P})',
        (req.outfit_items, req.weather_fit, req.event_fit,
         req.overall_note, req.feedback_type, req.feedback_text)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}


@app.post("/api/outfit-history")
def save_outfit_history(req: OutfitHistoryCreate):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        f'INSERT INTO outfit_history (item_ids,event_description,date) VALUES ({P},{P},{P})',
        (req.item_ids, req.event_description, req.date)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}


@app.get("/api/outfit-history")
def get_outfit_history():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM outfit_history ORDER BY created_at DESC')
    history = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return history


# ── Static files ──────────────────────────────────────────────────────────────
os.makedirs("static", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
