from ..connection import get_db
import json
import logging

logger = logging.getLogger(__name__)


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


def update_arr_config_on_rename(category, old_name, new_name):
    """
    Update arr_config data_to_sync when a format or profile is renamed.
    Args:
        category (str): Either 'customFormats' or 'profiles'
        old_name (str): Original name being changed
        new_name (str): New name to change to
    Returns:
        list: IDs of arr_config rows that were updated
    """
    updated_ids = []

    with get_db() as conn:
        # Get all configs that might reference this name
        rows = conn.execute(
            'SELECT id, data_to_sync FROM arr_config WHERE data_to_sync IS NOT NULL'
        ).fetchall()

        for row in rows:
            try:
                data = json.loads(row['data_to_sync'])
                # Check if this config has the relevant category data
                if category in data:
                    # Update any matching names
                    if old_name in data[category]:
                        # Replace old name with new name
                        data[category] = [
                            new_name if x == old_name else x
                            for x in data[category]
                        ]
                        # Save changes back to database
                        conn.execute(
                            'UPDATE arr_config SET data_to_sync = ? WHERE id = ?',
                            (json.dumps(data), row['id']))
                        updated_ids.append(row['id'])
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON in arr_config id={row['id']}")
                continue

        if updated_ids:
            conn.commit()

    return updated_ids


def update_arr_config_on_delete(category, name):
    """
    Update arr_config data_to_sync when a format or profile is deleted.
    Args:
        category (str): Either 'customFormats' or 'profiles' 
        name (str): Name being deleted
    Returns:
        list: IDs of arr_config rows that were updated
    """
    updated_ids = []

    with get_db() as conn:
        # Get all configs that might reference this name
        rows = conn.execute(
            'SELECT id, data_to_sync FROM arr_config WHERE data_to_sync IS NOT NULL'
        ).fetchall()

        for row in rows:
            try:
                data = json.loads(row['data_to_sync'])
                # Check if this config has the relevant category data
                if category in data:
                    # Remove any matching names
                    if name in data[category]:
                        data[category].remove(name)
                        # Save changes back to database
                        conn.execute(
                            'UPDATE arr_config SET data_to_sync = ? WHERE id = ?',
                            (json.dumps(data), row['id']))
                        updated_ids.append(row['id'])
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON in arr_config id={row['id']}")
                continue

        if updated_ids:
            conn.commit()

    return updated_ids
