# backend/app/db/queries/format_renames.py
import logging
from ..connection import get_db

logger = logging.getLogger(__name__)


def add_format_to_renames(format_name: str) -> None:
    """Add a format to the renames table"""
    with get_db() as conn:
        conn.execute(
            'INSERT OR REPLACE INTO format_renames (format_name) VALUES (?)',
            (format_name, ))
        conn.commit()
        logger.info(f"Added format to renames table: {format_name}")


def remove_format_from_renames(format_name: str) -> None:
    """Remove a format from the renames table"""
    with get_db() as conn:
        conn.execute('DELETE FROM format_renames WHERE format_name = ?',
                     (format_name, ))
        conn.commit()
        logger.info(f"Removed format from renames table: {format_name}")


def is_format_in_renames(format_name: str) -> bool:
    """Check if a format is in the renames table"""
    with get_db() as conn:
        result = conn.execute(
            'SELECT 1 FROM format_renames WHERE format_name = ?',
            (format_name, )).fetchone()
        return bool(result)
