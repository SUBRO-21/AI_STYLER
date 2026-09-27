import sqlite3
import os
import json

DATABASE_URL = os.getenv("DATABASE_URL")
DB_FILE = "wardrobe.db"
P = "%s" if DATABASE_URL else "?"


def get_db_connection():
    if DATABASE_URL:
        import psycopg2
        import psycopg2.extras
        conn = psycopg2.connect(DATABASE_URL)
        conn.cursor_factory = psycopg2.extras.RealDictCursor
        return conn
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    if DATABASE_URL:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS items (
                id SERIAL PRIMARY KEY,
                image_path TEXT NOT NULL,
                category TEXT,
                sub_type TEXT,
                color TEXT,
                formality TEXT,
                description TEXT,
                availability TEXT DEFAULT 'available',
                availability_updated_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS feedback (
                id SERIAL PRIMARY KEY,
                outfit_items TEXT,
                weather_fit TEXT,
                event_fit TEXT,
                overall_note TEXT,
                feedback_type TEXT,
                feedback_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS outfit_history (
                id SERIAL PRIMARY KEY,
                item_ids TEXT NOT NULL,
                event_description TEXT,
                date TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_path TEXT NOT NULL,
                category TEXT,
                sub_type TEXT,
                color TEXT,
                formality TEXT,
                description TEXT,
                availability TEXT DEFAULT 'available',
                availability_updated_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                outfit_items TEXT,
                weather_fit TEXT,
                event_fit TEXT,
                overall_note TEXT,
                feedback_type TEXT,
                feedback_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS outfit_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_ids TEXT NOT NULL,
                event_description TEXT,
                date TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    conn.commit()
    conn.close()


def insert_item(image_path, category, sub_type, color, formality, description):
    conn = get_db_connection()
    cursor = conn.cursor()
    if DATABASE_URL:
        cursor.execute(
            f'''INSERT INTO items (image_path, category, sub_type, color, formality, description)
               VALUES ({P}, {P}, {P}, {P}, {P}, {P}) RETURNING id''',
            (image_path, category, sub_type, color, formality, description)
        )
        item_id = cursor.fetchone()['id']
    else:
        cursor.execute(
            f'''INSERT INTO items (image_path, category, sub_type, color, formality, description)
               VALUES ({P}, {P}, {P}, {P}, {P}, {P})''',
            (image_path, category, sub_type, color, formality, description)
        )
        item_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return item_id


def get_items():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM items ORDER BY created_at DESC")
    items = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT item_ids, created_at FROM outfit_history ORDER BY created_at DESC")
    history_rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    last_worn = {}
    for row in history_rows:
        try:
            for iid in json.loads(row["item_ids"]):
                if iid not in last_worn:
                    last_worn[iid] = str(row["created_at"])
        except Exception:
            pass

    for item in items:
        item["last_worn"] = last_worn.get(item["id"])
    return items


def get_available_items():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT id, category, sub_type, color, formality, description, image_path "
        f"FROM items WHERE availability = {P}",
        ('available',)
    )
    items = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return items


def delete_item(item_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(f"SELECT image_path FROM items WHERE id = {P}", (item_id,))
    row = cursor.fetchone()
    image_path = dict(row)["image_path"] if row else None
    cursor.execute(f"DELETE FROM items WHERE id = {P}", (item_id,))
    conn.commit()
    conn.close()
    return image_path


def update_availability(item_id: int, availability: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"UPDATE items SET availability = {P}, availability_updated_at = CURRENT_TIMESTAMP WHERE id = {P}",
        (availability, item_id)
    )
    conn.commit()
    conn.close()


def insert_outfit_history(item_ids: str, event_description: str, date: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"INSERT INTO outfit_history (item_ids, event_description, date) VALUES ({P}, {P}, {P})",
        (item_ids, event_description, date)
    )
    conn.commit()
    conn.close()


def get_outfit_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM outfit_history ORDER BY created_at DESC")
    history = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return history


def insert_feedback(outfit_items, weather_fit, event_fit, overall_note, feedback_type, feedback_text):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        f'''INSERT INTO feedback (outfit_items, weather_fit, event_fit, overall_note, feedback_type, feedback_text)
           VALUES ({P}, {P}, {P}, {P}, {P}, {P})''',
        (outfit_items, weather_fit, event_fit, overall_note, feedback_type, feedback_text)
    )
    conn.commit()
    conn.close()


def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as n FROM items")
    item_count = dict(cursor.fetchone())["n"]
    cursor.execute("SELECT COUNT(*) as n FROM outfit_history")
    outfit_count = dict(cursor.fetchone())["n"]
    conn.close()
    return {"item_count": item_count, "outfit_count": outfit_count}


def clear_all_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM items")
    cursor.execute("DELETE FROM outfit_history")
    cursor.execute("DELETE FROM feedback")
    conn.commit()
    conn.close()
