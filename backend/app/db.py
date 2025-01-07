# db.py
import sqlite3
import os
import secrets
from .config import config

DB_PATH = config.DB_PATH


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute('''
        CREATE TABLE IF NOT EXISTS backups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'pending'
        )
        ''')

        conn.execute('''
        CREATE TABLE IF NOT EXISTS arr_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL,
            tags TEXT,
            arr_server TEXT NOT NULL,
            api_key TEXT NOT NULL,
            data_to_sync TEXT,
            last_sync_time TIMESTAMP,
            sync_percentage INTEGER DEFAULT 0,
            sync_method TEXT DEFAULT 'manual',
            sync_interval INTEGER DEFAULT 0,
            import_as_unique BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        conn.execute('''
        CREATE TABLE IF NOT EXISTS scheduled_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            interval_minutes INTEGER NOT NULL,
            last_run TIMESTAMP,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Insert required tasks if missing
        required_tasks = [
            ('Repository Sync', 'Sync', 2),
            ('Backup', 'Backup', 1440),
        ]
        for task_name, task_type, interval in required_tasks:
            cursor = conn.execute(
                'SELECT COUNT(*) FROM scheduled_tasks WHERE name = ?',
                (task_name, ))
            if cursor.fetchone()[0] == 0:
                conn.execute(
                    '''
                    INSERT INTO scheduled_tasks (name, type, interval_minutes)
                    VALUES (?, ?, ?)
                    ''', (task_name, task_type, interval))

        conn.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        conn.execute('''
            INSERT OR IGNORE INTO settings (key, value, updated_at)
            VALUES ('auto_pull_enabled', 0, CURRENT_TIMESTAMP)
        ''')

        profilarr_pat = os.environ.get('PROFILARR_PAT')
        conn.execute(
            '''
            INSERT INTO settings (key, value, updated_at)
            VALUES ('has_profilarr_pat', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = ?,
                updated_at = CURRENT_TIMESTAMP
            ''', (str(bool(profilarr_pat)).lower(), str(
                bool(profilarr_pat)).lower()))

        conn.commit()

        secret_key = conn.execute(
            'SELECT value FROM settings WHERE key = "secret_key"').fetchone()
        if not secret_key:
            new_secret_key = secrets.token_hex(32)
            conn.execute(
                '''
                INSERT INTO settings (key, value, updated_at)
                VALUES ('secret_key', ?, CURRENT_TIMESTAMP)
                ''', (new_secret_key, ))
        conn.commit()

        conn.execute('''
            CREATE TABLE IF NOT EXISTS auth (
                username TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                api_key TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS failed_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip_address TEXT NOT NULL,
                attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')


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
