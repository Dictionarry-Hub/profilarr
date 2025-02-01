# backend/app/db/queries/settings.py
from ..connection import get_db


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
