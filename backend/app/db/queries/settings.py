# backend/app/db/queries/settings.py
from ..connection import get_db
import logging
import os

logger = logging.getLogger(__name__)


def get_settings():
    with get_db() as conn:
        result = conn.execute(
            'SELECT key, value FROM settings WHERE key NOT IN ("secret_key")'
        ).fetchall()
        settings = {row['key']: row['value'] for row in result}
        return settings if 'gitRepo' in settings else None


def get_secret_key():
    with get_db() as conn:
        result = conn.execute(
            'SELECT value FROM settings WHERE key = "secret_key"').fetchone()
        return result['value'] if result else None


def save_settings(settings_dict):
    with get_db() as conn:
        for key, value in settings_dict.items():
            conn.execute(
                '''
                INSERT INTO settings (key, value, updated_at) 
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = CURRENT_TIMESTAMP
                ''', (key, value))
        conn.commit()


def update_pat_status():
    """Update the has_profilarr_pat setting based on current environment."""
    with get_db() as conn:
        profilarr_pat = os.environ.get('PROFILARR_PAT')
        pat_exists = str(bool(profilarr_pat)).lower()

        # Get current value
        current = conn.execute('SELECT value FROM settings WHERE key = ?',
                               ('has_profilarr_pat', )).fetchone()

        conn.execute(
            '''
            INSERT INTO settings (key, value, updated_at)
            VALUES ('has_profilarr_pat', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = ?,
                updated_at = CURRENT_TIMESTAMP
            ''', (pat_exists, pat_exists))
        conn.commit()

        if current is None:
            logger.info(f"PAT status created: {pat_exists}")
        elif current[0] != pat_exists:
            logger.info(
                f"PAT status updated from {current[0]} to {pat_exists}")
        else:
            logger.debug("PAT status unchanged")
