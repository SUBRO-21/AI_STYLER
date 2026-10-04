import sqlite3
import os

DB_FILE = "wardrobe.db"


def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def _col_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

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

    # SQLite column migrations if needed
    migrations = [
        ('items', 'sub_type', 'TEXT'),
        ('items', 'availability', "TEXT DEFAULT 'available'"),
        ('items', 'availability_updated_at', 'TIMESTAMP'),
    ]
    for table, col, defn in migrations:
        if not _col_exists(cursor, table, col):
            cursor.execute(f'ALTER TABLE {table} ADD COLUMN {col} {defn}')

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print(f"Local database initialized: {DB_FILE}")
