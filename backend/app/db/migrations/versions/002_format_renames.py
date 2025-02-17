# backend/app/db/migrations/versions/002_format_renames.py
from ...connection import get_db

version = 2
name = "format_renames"


def up():
    """Add table for tracking which formats to include in renames"""
    with get_db() as conn:
        conn.execute('''
        CREATE TABLE IF NOT EXISTS format_renames (
            format_name TEXT PRIMARY KEY NOT NULL
        )
        ''')
        conn.commit()


def down():
    """Remove the format_renames table"""
    with get_db() as conn:
        conn.execute('DROP TABLE IF EXISTS format_renames')
        conn.commit()
