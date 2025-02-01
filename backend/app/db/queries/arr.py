# backend/app/db/queries/arr.py
from ..connection import get_db


def get_unique_arrs(arr_ids):
    """
    Get import_as_unique settings for a list of arr IDs.
    
    Args:
        arr_ids (list): List of arr configuration IDs
        
    Returns:
        dict: Dictionary mapping arr IDs to their import_as_unique settings and names
    """
    if not arr_ids:
        return {}

    with get_db() as conn:
        placeholders = ','.join('?' * len(arr_ids))
        query = f'''
            SELECT id, name, import_as_unique 
            FROM arr_config 
            WHERE id IN ({placeholders})
        '''

        results = conn.execute(query, arr_ids).fetchall()
        return {
            row['id']: {
                'import_as_unique': bool(row['import_as_unique']),
                'name': row['name']
            }
            for row in results
        }
