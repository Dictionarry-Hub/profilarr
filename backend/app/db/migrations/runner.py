# backend/app/db/migrations/runner.py
import os
import importlib
from pathlib import Path
from ..connection import get_db


def init_migrations():
    """Create migrations table if it doesn't exist."""
    with get_db() as conn:
        conn.execute('''
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version INTEGER NOT NULL,
            name TEXT NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        conn.commit()


def get_applied_migrations():
    """Get list of already applied migrations."""
    with get_db() as conn:
        result = conn.execute(
            'SELECT version FROM migrations ORDER BY version')
        return [row[0] for row in result.fetchall()]


def get_available_migrations():
    """Get all migration files from versions directory."""
    versions_dir = Path(__file__).parent / 'versions'
    migrations = []

    for file in versions_dir.glob('[0-9]*.py'):
        if file.stem != '__init__':
            # Import the migration module
            module = importlib.import_module(f'.versions.{file.stem}',
                                             package='app.db.migrations')
            migrations.append((module.version, module.name, module))

    return sorted(migrations, key=lambda x: x[0])


def run_migrations():
    """Run all pending migrations in order."""
    init_migrations()
    applied = set(get_applied_migrations())
    available = get_available_migrations()

    for version, name, module in available:
        if version not in applied:
            print(f"Applying migration {version}: {name}")
            try:
                module.up()
                with get_db() as conn:
                    conn.execute(
                        'INSERT INTO migrations (version, name) VALUES (?, ?)',
                        (version, name))
                    conn.commit()
                print(f"Successfully applied migration {version}")
            except Exception as e:
                print(f"Error applying migration {version}: {str(e)}")
                raise
