# backend/app/db/migrations/versions/001_initial_schema.py
import os
import secrets
from ...connection import get_db

version = 1
name = "initial_schema"


def up():
    """Apply the initial database schema."""
    with get_db() as conn:
        # Create backups table
        conn.execute('''
        CREATE TABLE IF NOT EXISTS backups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'pending'
        )
        ''')

        # Create arr_config table
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
            import_task_id INTEGER DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Create scheduled_tasks table
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

        # Create settings table
        conn.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Create auth table
        conn.execute('''
        CREATE TABLE IF NOT EXISTS auth (
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            api_key TEXT,
            session_id TEXT, 
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Create failed_attempts table
        conn.execute('''
        CREATE TABLE IF NOT EXISTS failed_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address TEXT NOT NULL,
            attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Insert initial required data
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

        # Insert initial settings
        conn.execute('''
            INSERT OR IGNORE INTO settings (key, value, updated_at)
            VALUES ('auto_pull_enabled', '0', CURRENT_TIMESTAMP)
        ''')

        # Handle profilarr_pat setting
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

        # Handle secret_key setting
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


def down():
    """Revert the initial schema migration."""
    with get_db() as conn:
        # Drop all tables in reverse order of creation
        tables = [
            'failed_attempts', 'auth', 'settings', 'scheduled_tasks',
            'arr_config', 'backups'
        ]
        for table in tables:
            conn.execute(f'DROP TABLE IF EXISTS {table}')
        conn.commit()
