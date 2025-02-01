# backend/app/db/connection.py
import sqlite3
from ..config import config

DB_PATH = config.DB_PATH


def get_db():
    """Create and return a database connection with Row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
