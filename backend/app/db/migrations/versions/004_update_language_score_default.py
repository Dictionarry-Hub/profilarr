# backend/app/db/migrations/versions/004_update_language_score_default.py
from ...connection import get_db

version = 4
name = "update_language_score_default"


def up():
    """Update default language import score to -999999."""
    with get_db() as conn:
        # Update existing record to new default value
        conn.execute('''
            UPDATE language_import_config 
            SET score = -999999, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        ''')
        
        conn.commit()


def down():
    """Revert language import score to previous default."""
    with get_db() as conn:
        # Revert to previous default value
        conn.execute('''
            UPDATE language_import_config 
            SET score = -99999, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        ''')
        
        conn.commit()