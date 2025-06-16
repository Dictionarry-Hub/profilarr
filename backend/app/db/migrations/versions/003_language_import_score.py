# backend/app/db/migrations/versions/003_language_import_score.py
from ...connection import get_db

version = 3
name = "language_import_score"


def up():
    """Add language_import_config table."""
    with get_db() as conn:
        # Create language_import_config table
        conn.execute('''
        CREATE TABLE IF NOT EXISTS language_import_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            score INTEGER NOT NULL DEFAULT -99999,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Insert default record
        conn.execute('''
            INSERT INTO language_import_config (score, updated_at)
            VALUES (-99999, CURRENT_TIMESTAMP)
        ''')

        conn.commit()


def down():
    """Remove language_import_config table."""
    with get_db() as conn:
        conn.execute('DROP TABLE IF EXISTS language_import_config')
        conn.commit()