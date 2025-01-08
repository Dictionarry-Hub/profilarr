# arr/task_utils.py

import logging
from ..db import get_db

logger = logging.getLogger(__name__)


def create_import_task_for_arr_config(config_id, config_name, sync_method,
                                      sync_interval):
    """
    Create a scheduled task for the given ARR config (if needed).
    Returns the newly-created task id or None.
    """
    if sync_method == 'manual':
        logger.debug(
            f"[ARR Tasks] No import task created for {config_name} because sync_method=manual"
        )
        return None

    with get_db() as conn:
        cursor = conn.cursor()

        # 'pull' tasks can be represented with interval 0 or a special type
        # 'schedule' tasks can be represented with the normal interval

        if sync_method == 'pull':
            # You could store a special type for pull-based tasks
            task_type = 'ImportPull'
            interval_minutes = 0
        else:  # 'schedule'
            task_type = 'ImportSchedule'
            interval_minutes = sync_interval or 0

        # Insert into scheduled_tasks table
        cursor.execute(
            '''
            INSERT INTO scheduled_tasks (name, type, interval_minutes, status)
            VALUES (?, ?, ?, ?)
            ''', (f"Import for ARR #{config_id} - {config_name}", task_type,
                  interval_minutes, 'pending'))
        new_task_id = cursor.lastrowid
        conn.commit()

        logger.debug(
            f"[ARR Tasks] Created new {task_type} task with ID {new_task_id} for ARR config {config_id}"
        )
        return new_task_id


def update_import_task_for_arr_config(config_id, config_name, sync_method,
                                      sync_interval, existing_task_id):
    """
    Update the existing scheduled task for the given ARR config (if needed).
    If the sync_method changes from 'pull' to 'schedule' or vice versa, you might prefer to delete + recreate.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        if sync_method == 'manual':
            # If user changed to manual, remove the old task
            cursor.execute('DELETE FROM scheduled_tasks WHERE id = ?',
                           (existing_task_id, ))
            deleted_count = cursor.rowcount
            conn.commit()
            if deleted_count:
                logger.debug(
                    f"[ARR Tasks] Deleted import task {existing_task_id} because config changed to manual"
                )
            return None

        # Otherwise update existing
        if sync_method == 'pull':
            task_type = 'ImportPull'
            interval_minutes = 0
        else:  # 'schedule'
            task_type = 'ImportSchedule'
            interval_minutes = sync_interval or 0

        cursor.execute(
            '''
            UPDATE scheduled_tasks
            SET name = ?, type = ?, interval_minutes = ?
            WHERE id = ?
            ''', (
                f"Import for ARR #{config_id} - {config_name}",
                task_type,
                interval_minutes,
                existing_task_id,
            ))
        updated_count = cursor.rowcount
        conn.commit()

        if updated_count == 0:
            logger.debug(
                f"[ARR Tasks] No existing task found (ID={existing_task_id}) for ARR config {config_id}; creating new one."
            )
            return create_import_task_for_arr_config(config_id, config_name,
                                                     sync_method,
                                                     sync_interval)

        logger.debug(
            f"[ARR Tasks] Updated existing import task {existing_task_id} for ARR config {config_id}"
        )
        return existing_task_id


def delete_import_task_for_arr_config(task_id):
    """
    Delete the import task if it exists.
    """
    if not task_id:
        return
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM scheduled_tasks WHERE id = ?', (task_id, ))
        conn.commit()
        if cursor.rowcount > 0:
            logger.debug(f"[ARR Tasks] Deleted import task with ID {task_id}")
        else:
            logger.debug(
                f"[ARR Tasks] No import task found to delete with ID {task_id}"
            )
