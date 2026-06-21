import os
import shutil
import requests
from urllib.parse import quote
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional

import database
import llm_service

app = FastAPI()

# Enable CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory exists
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize DB on startup
database.init_db()

# --- Pydantic Models ---

class ItemCreate(BaseModel):
    image_path: str
    category: str
    color: str
    formality: str
    description: str

class AvailabilityUpdate(BaseModel):
    available: bool

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

# --- API Endpoints ---

@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    # Save file temporarily
    file_path = os.path.join(UPLOAD_DIR, os.path.basename(file.filename))
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Analyze with LLM
    tags = llm_service.analyze_image_for_tags(file_path)
    
    return {
        "image_path": file_path,
        "tags": tags
    }

@app.post("/api/items")
def create_item(item: ItemCreate):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO items (image_path, category, color, formality, description)
        VALUES (?, ?, ?, ?, ?)
    ''', (item.image_path, item.category, item.color, item.formality, item.description))
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
    conn.close()
    return items

@app.patch("/api/items/{item_id}/availability")
def update_availability(item_id: int, update: AvailabilityUpdate):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE items SET available = ? WHERE id = ?', (update.available, item_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/weather")
def get_weather(event: EventInput):
    # 1. Geocode the city
    geocode_url = f"https://geocoding-api.open-meteo.com/v1/search?name={quote(event.location)}&count=1&format=json"
    try:
        geo_res = requests.get(geocode_url, timeout=10).json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Geocoding service unavailable: {e}")

    if not geo_res.get("results"):
        raise HTTPException(status_code=404, detail=f"Location not found: '{event.location}'")
        
    lat = geo_res["results"][0]["latitude"]
    lon = geo_res["results"][0]["longitude"]
    
    # 2. Fetch weather for the coordinates (simplified for MVP: just get daily forecast)
    weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=auto"
    weather_res = requests.get(weather_url).json()
    
    # In a real app we'd match event.date to the forecast array. 
    # For MVP, just return the first day's forecast.
    daily = weather_res.get("daily", {})
    if not daily:
        raise HTTPException(status_code=500, detail="Could not fetch weather data")
        
    weather_data = {
        "temp_max": daily.get("temperature_2m_max", [None])[0],
        "temp_min": daily.get("temperature_2m_min", [None])[0],
        "precip_chance": daily.get("precipitation_probability_max", [None])[0],
        "conditions_code": daily.get("weathercode", [None])[0]
    }
    
    return weather_data

@app.post("/api/generate")
def generate_outfit(req: OutfitGenerationRequest):
    # Fetch available items
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id, category, color, formality, description FROM items WHERE available = 1')
    available_items = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    outfits = llm_service.generate_outfits(available_items, req.event, req.weather)
    return {"outfits": outfits}

@app.post("/api/feedback")
def save_feedback(req: FeedbackRequest):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO feedback (outfit_items, weather_fit, event_fit, overall_note, feedback_type, feedback_text)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (req.outfit_items, req.weather_fit, req.event_fit, req.overall_note, req.feedback_type, req.feedback_text))
    conn.commit()
    conn.close()
    return {"status": "success"}

# Serve the static files for the React frontend
os.makedirs("static", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    # pyrefly: ignore [missing-import]
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
