import os
import uuid
import shutil
import tempfile
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

app = FastAPI(title="AI Stylist")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Use /tmp on Vercel/serverless environments, local uploads/ folder otherwise
IS_SERVERLESS = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "ai_styler_uploads") if IS_SERVERLESS else "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

try:
    database.init_db()
except Exception as e:
    print(f"Warning: Database init failed on import: {e}")


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)


# ── Storage Helper ────────────────────────────────────────────────────────────

def save_upload(file_path: str, filename: str) -> str:
    """If CLOUDINARY_URL is configured, upload to Cloudinary. Otherwise return local path."""
    cloudinary_url = os.getenv("CLOUDINARY_URL")
    if cloudinary_url:
        import cloudinary
        import cloudinary.uploader
        cloudinary.config(cloudinary_url=cloudinary_url)
        clean_name = os.path.splitext(filename)[0]
        result = cloudinary.uploader.upload(
            file_path,
            public_id=f"ai-styler/{clean_name}",
            overwrite=True,
        )
        return result["secure_url"]
    return file_path


# ── Pydantic models ───────────────────────────────────────────────────────────

class ItemCreate(BaseModel):
    image_path: str
    category: str
    sub_type: Optional[str] = None
    color: str
    formality: str
    description: str

class AvailabilityUpdate(BaseModel):
    availability: str

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
        return {"profile_photo": profile_path}
    return {"profile_photo": None}


@app.post("/api/profile-photo")
async def upload_profile_photo(file: UploadFile = File(...)):
    local_path = os.path.join(UPLOAD_DIR, "_profile_user.jpg")
    with open(local_path, "wb") as buf:
        shutil.copyfileobj(file.file, buf)
    stored_path = save_upload(local_path, "_profile_user.jpg")
    return {"profile_photo": stored_path}


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
    return database.get_stats()


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

    stored_path = save_upload(local_path, safe_name)
    return {"image_path": stored_path, "tags": tags}


@app.post("/api/items")
def create_item(item: ItemCreate):
    item_id = database.insert_item(
        item.image_path, item.category, item.sub_type,
        item.color, item.formality, item.description
    )
    return {"id": item_id, "status": "success"}


@app.get("/api/items")
def get_items():
    return database.get_items()


@app.delete("/api/items/{item_id}")
def delete_item(item_id: int):
    image_path = database.delete_item(item_id)
    if image_path and os.path.exists(image_path):
        try:
            os.remove(image_path)
        except Exception:
            pass
    return {"status": "success"}


@app.patch("/api/items/{item_id}/availability")
def update_availability(item_id: int, update: AvailabilityUpdate):
    if update.availability not in ("available", "washing", "damaged"):
        raise HTTPException(status_code=400, detail="availability must be 'available', 'washing', or 'damaged'")
    database.update_availability(item_id, update.availability)
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
    available_items = database.get_available_items()
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
    database.insert_feedback(
        req.outfit_items, req.weather_fit, req.event_fit,
        req.overall_note, req.feedback_type, req.feedback_text
    )
    return {"status": "success"}


@app.post("/api/outfit-history")
def save_outfit_history(req: OutfitHistoryCreate):
    database.insert_outfit_history(req.item_ids, req.event_description, req.date)
    return {"status": "success"}


@app.get("/api/outfit-history")
def get_outfit_history():
    return database.get_outfit_history()


@app.delete("/api/clear-data")
def clear_all_data():
    database.clear_all_data()
    if os.path.exists(UPLOAD_DIR):
        for f in os.listdir(UPLOAD_DIR):
            fp = os.path.join(UPLOAD_DIR, f)
            if os.path.isfile(fp):
                try:
                    os.remove(fp)
                except Exception:
                    pass
    return {"status": "success"}


# ── Static files & Local Dev Server ───────────────────────────────────────────

if os.path.exists("uploads"):
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*50)
    print(" AI STYLIST RUNNING")
    print(" Open in browser: http://localhost:8000")
    print("="*50 + "\n")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
