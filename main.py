import os
import json
import uuid
import shutil
import traceback
import requests
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import database
import llm_service

app = FastAPI(title="AI Stylist (Local)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
database.init_db()


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)


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
    item_ids: str
    event_description: str
    date: str


# ── Profile & Stats Endpoints ──────────────────────────────────────────────────

@app.get("/api/profile-photo")
def get_profile_photo():
    profile_path = os.path.join(UPLOAD_DIR, "_profile_user.jpg")
    if os.path.exists(profile_path):
        return {"profile_photo": profile_path.replace("\\", "/")}
    return {"profile_photo": None}


@app.post("/api/profile-photo")
async def upload_profile_photo(file: UploadFile = File(...)):
    profile_path = os.path.join(UPLOAD_DIR, "_profile_user.jpg")
    with open(profile_path, "wb") as buf:
        shutil.copyfileobj(file.file, buf)
    return {"profile_photo": profile_path.replace("\\", "/")}


@app.delete("/api/profile-photo")
def delete_profile_photo():
    profile_path = os.path.join(UPLOAD_DIR, "_profile_user.jpg")
    if os.path.exists(profile_path):
        try:
            os.remove(profile_path)
        except Exception:
            pass
    return {"status": "success"}


@app.get("/api/profile-stats")
def get_profile_stats():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as n FROM items")
    item_count = dict(cursor.fetchone())["n"]
    cursor.execute("SELECT COUNT(*) as n FROM outfit_history")
    outfit_count = dict(cursor.fetchone())["n"]
    conn.close()
    return {"item_count": item_count, "outfit_count": outfit_count}


# ── Wardrobe Item Endpoints ────────────────────────────────────────────────────

@app.post("/api/upload")
async def upload_image(
    file: UploadFile = File(...),
    x_gemini_key: Optional[str] = Header(default=None),
):
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    safe_name = f"{uuid.uuid4().hex[:12]}{ext}"
    local_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(local_path, "wb") as buf:
        shutil.copyfileobj(file.file, buf)

    try:
        tags = llm_service.analyze_image_for_tags(local_path, user_key=x_gemini_key)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=422, detail=f"AI tagging failed: {e}")

    return {"image_path": local_path.replace("\\", "/"), "tags": tags}


@app.post("/api/items")
def create_item(item: ItemCreate):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''INSERT INTO items (image_path, category, sub_type, color, formality, description)
           VALUES (?, ?, ?, ?, ?, ?)''',
        (item.image_path, item.category, item.sub_type, item.color, item.formality, item.description)
    )
    item_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": item_id, "status": "success"}


@app.get("/api/items")
def get_items():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM items ORDER BY created_at DESC")
    items = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT item_ids, created_at FROM outfit_history ORDER BY created_at DESC")
    history_rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    last_worn: dict = {}
    for row in history_rows:
        try:
            for iid in json.loads(row["item_ids"]):
                if iid not in last_worn:
                    last_worn[iid] = row["created_at"]
        except Exception:
            pass

    for item in items:
        item["last_worn"] = last_worn.get(item["id"])
    return items


@app.delete("/api/items/{item_id}")
def delete_item(item_id: int):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT image_path FROM items WHERE id = ?", (item_id,))
    row = cursor.fetchone()
    if row and row["image_path"] and os.path.exists(row["image_path"]):
        try:
            os.remove(row["image_path"])
        except Exception:
            pass

    cursor.execute("DELETE FROM items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


@app.patch("/api/items/{item_id}/availability")
def update_availability(item_id: int, update: AvailabilityUpdate):
    if update.availability not in ("available", "washing", "damaged"):
        raise HTTPException(status_code=400, detail="availability must be 'available', 'washing', or 'damaged'")
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE items SET availability = ?, availability_updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (update.availability, item_id)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}


# ── Weather & Outfit Generation ────────────────────────────────────────────────

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
def generate_outfit(
    req: OutfitGenerationRequest,
    x_gemini_key: Optional[str] = Header(default=None),
):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, category, sub_type, color, formality, description, image_path "
        "FROM items WHERE availability = 'available'"
    )
    available_items = [dict(row) for row in cursor.fetchall()]
    conn.close()

    if not available_items:
        raise HTTPException(status_code=400, detail="No available clothes found in wardrobe. Upload clothes first!")

    outfits = llm_service.generate_outfits(
        available_items, req.event, req.weather, user_key=x_gemini_key
    )
    if not outfits:
        return {"outfits": []}

    items_map = {item["id"]: item for item in available_items}
    profile_path = os.path.join(UPLOAD_DIR, "_profile_user.jpg")
    user_photo = profile_path if os.path.exists(profile_path) else None

    def gen_image(outfit):
        paths = [
            items_map[iid]["image_path"]
            for iid in outfit.get("item_ids", [])
            if iid in items_map
        ]
        return llm_service.generate_outfit_image(
            paths, req.event, user_photo_path=user_photo, user_key=x_gemini_key
        )

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(gen_image, outfit): i for i, outfit in enumerate(outfits)}
        for future in as_completed(futures):
            idx = futures[future]
            try:
                outfits[idx]["outfit_image"] = future.result(timeout=60)
            except Exception:
                outfits[idx]["outfit_image"] = None

    return {"outfits": outfits}


# ── Feedback & History Endpoints ───────────────────────────────────────────────

@app.post("/api/feedback")
def save_feedback(req: FeedbackRequest):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''INSERT INTO feedback (outfit_items, weather_fit, event_fit, overall_note, feedback_type, feedback_text)
           VALUES (?, ?, ?, ?, ?, ?)''',
        (req.outfit_items, req.weather_fit, req.event_fit, req.overall_note, req.feedback_type, req.feedback_text)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}


@app.post("/api/outfit-history")
def save_outfit_history(req: OutfitHistoryCreate):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO outfit_history (item_ids, event_description, date) VALUES (?, ?, ?)",
        (req.item_ids, req.event_description, req.date)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}


@app.get("/api/outfit-history")
def get_outfit_history():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outfit_history ORDER BY created_at DESC")
    history = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return history


@app.delete("/api/clear-data")
def clear_all_data():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM items")
    cursor.execute("DELETE FROM outfit_history")
    cursor.execute("DELETE FROM feedback")
    conn.commit()
    conn.close()

    # Clean local uploads folder except profile if needed
    for f in os.listdir(UPLOAD_DIR):
        fp = os.path.join(UPLOAD_DIR, f)
        if os.path.isfile(fp):
            try:
                os.remove(fp)
            except Exception:
                pass

    return {"status": "success"}


# ── Static files & Local Server ───────────────────────────────────────────────

os.makedirs("static", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*50)
    print(" AI STYLIST RUNNING LOCALLY")
    print(" Open in browser: http://localhost:8000")
    print("="*50 + "\n")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
