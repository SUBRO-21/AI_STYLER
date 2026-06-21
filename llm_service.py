import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")

def analyze_image_for_tags(file_path):
    """
    Analyzes an image and returns JSON tags.
    """
    if not api_key or api_key == "your_gemini_api_key_here":
        # Stub response if no API key
        return {
            "category": "top",
            "color": "Mustard (Wada Sanzo)",
            "formality": "casual",
            "description": "A stylish mustard yellow top."
        }

    try:
        client = genai.Client(api_key=api_key)
        # Upload the file to Gemini API temporarily
        sample_file = client.files.upload(file=file_path)
        
        prompt = """
        Analyze this clothing item. Return ONLY a valid JSON object with the following keys:
        - "category": one of [top, bottom, outerwear, shoes, accessory, dress]
        - "color": primary color, mapped to a closest Wada Sanzo color concept (e.g., Carmine, Celadon, Mustard)
        - "formality": one of [casual, smart-casual, formal]
        - "description": a one-line concise description of the item

        Do not wrap in markdown tags like ```json, just return the raw JSON text.
        """
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[sample_file, prompt]
        )
        
        # Cleanup file from Gemini servers
        client.files.delete(name=sample_file.name)
        
        # Parse output
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
            
        return json.loads(text.strip())
        
    except Exception as e:
        print(f"Error in LLM vision tagging: {e}")
        # Fallback to stub
        return {
            "category": "top",
            "color": "Unknown",
            "formality": "casual",
            "description": "Could not analyze image."
        }

def generate_outfits(available_items, event_description, weather_data):
    """
    Generates 2-3 outfit recommendations based on wardrobe, event, and weather.
    """
    if not api_key or api_key == "your_gemini_api_key_here":
        # Stub response if no API key
        if not available_items:
            return []
        
        item_ids = [item['id'] for item in available_items[:2]]
        return [
            {
                "item_ids": item_ids,
                "reasoning": {
                    "weather_fit": "Perfect for this weather.",
                    "event_fit": "Fits the vibe perfectly.",
                    "overall_note": "A classic pairing inspired by Wada Sanzo's contrasts."
                }
            }
        ]

    try:
        client = genai.Client(api_key=api_key)
        items_json = json.dumps(available_items, indent=2)
        weather_json = json.dumps(weather_data, indent=2)
        
        prompt = f"""
        You are an expert fashion stylist deeply trained in Wada Sanzo's "A Dictionary of Color Combinations".
        
        Given the following available wardrobe items, an event description, and weather forecast, generate 2 to 3 complete outfit recommendations. 
        Each outfit must be composed entirely of items from the provided wardrobe (refer to them by their 'id').

        Event: {event_description}
        Weather: {weather_json}
        Wardrobe Items: {items_json}

        Return ONLY a valid JSON array of objects. Each object must have:
        - "item_ids": an array of integer item IDs forming the outfit
        - "reasoning": an object with these exact keys:
            - "weather_fit": A short sentence on why this works for the weather.
            - "event_fit": A short sentence on why this works for the event.
            - "overall_note": A short note on the overall aesthetic, EXPLICITLY referencing Wada Sanzo color combination principles based on the colors of the items chosen.

        Do not wrap in markdown tags like ```json, just return the raw JSON text.
        """
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        
        # Parse output
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
            
        return json.loads(text.strip())
        
    except Exception as e:
        print(f"Error in LLM outfit generation: {e}")
        return []
