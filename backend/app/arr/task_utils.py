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

        # pull: not scheduled; on-demand during git pull
        if sync_method == 'pull':
            logger.debug(
                f"[ARR Tasks] No scheduled task created for {config_name} because sync_method=pull (runs on git pull)"
            )
            return None

        # schedule: create an interval-based task
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
    If the sync_method changes from 'pull' or 'manual' to 'schedule', we create or update.
    If it changes from 'schedule' to 'pull' (or 'manual'), we delete the old scheduled row.
    """

    with get_db() as conn:
        cursor = conn.cursor()

        # If user changed to manual or pull => remove the old row (if any)
        if sync_method in ['manual', 'pull']:
            if existing_task_id:
                logger.debug(
                    f"[update_import_task_for_arr_config] Removing old task {existing_task_id} because sync_method={sync_method}"
                )
                cursor.execute('DELETE FROM scheduled_tasks WHERE id = ?',
                               (existing_task_id, ))
                deleted_count = cursor.rowcount
                conn.commit()
                if deleted_count:
                    logger.info(
                        f"[update_import_task_for_arr_config] Deleted old task {existing_task_id} for ARR #{config_id}"
                    )
            # For 'pull' or 'manual', we do NOT create a new row in `scheduled_tasks`
            return None

        # Otherwise, sync_method='schedule' => create or update
        # (We keep the same logic as before if user wants a scheduled import)
        task_type = 'ImportSchedule'
        interval_minutes = sync_interval or 0

        # If there's NO existing task, create a new one
        if not existing_task_id:
            logger.debug(
                f"[update_import_task_for_arr_config] No existing task for ARR #{config_id}; creating new schedule."
            )
            return create_import_task_for_arr_config(config_id, config_name,
                                                     sync_method,
                                                     sync_interval)

        # If we DO have an existing scheduled task => update it
        logger.debug(
            f"[update_import_task_for_arr_config] Updating existing task {existing_task_id} for ARR #{config_id}, interval={interval_minutes}"
        )
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
            logger.warning(
                f"[update_import_task_for_arr_config] Could not find scheduled task {existing_task_id} for ARR #{config_id}, creating new."
            )
            return create_import_task_for_arr_config(config_id, config_name,
                                                     sync_method,
                                                     sync_interval)

        logger.debug(
            f"[update_import_task_for_arr_config] Successfully updated scheduled task {existing_task_id} for ARR #{config_id}"
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
