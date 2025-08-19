# arr/manager.py

from ..db import get_db
import json
import logging

# Import our task-utils that handle DB insertion for scheduled tasks
from .task_utils import (create_import_task_for_arr_config,
                         update_import_task_for_arr_config,
                         delete_import_task_for_arr_config)

from ..task.tasks import TaskScheduler

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


def save_arr_config(config):
    """
    Create a new arr_config row, then create a corresponding scheduled task (if sync_method != manual).
    Store the newly created task's ID in arr_config.import_task_id.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            # Check if name already exists
            existing = cursor.execute(
                'SELECT id FROM arr_config WHERE name = ?',
                (config['name'], )).fetchone()

            if existing:
                logger.warning(
                    f"[save_arr_config] Attempted to create duplicate config name: {config['name']}"
                )
                return {
                    'success': False,
                    'error': 'Configuration with this name already exists',
                    'status_code': 409
                }

            # 1) Insert the arr_config row
            logger.debug(
                f"[save_arr_config] Attempting to create new arr_config with name={config['name']} sync_method={config.get('sync_method')}"
            )

            cursor.execute(
                '''
                INSERT INTO arr_config (
                    name, type, tags, arr_server, api_key, 
                    data_to_sync, last_sync_time, sync_percentage,
                    sync_method, sync_interval, import_as_unique,
                    import_task_id
                )
                VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, NULL)
                ''', (
                    config['name'],
                    config['type'],
                    json.dumps(config.get('tags', [])),
                    config['arrServer'],
                    config['apiKey'],
                    json.dumps(config.get('data_to_sync', {})),
                    config.get('sync_method', 'manual'),
                    config.get('sync_interval', 0),
                    config.get('import_as_unique', False),
                ))
            conn.commit()

            new_config_id = cursor.lastrowid
            logger.info(
                f"[save_arr_config] Created new arr_config row #{new_config_id} for '{config['name']}'"
            )

            # 2) Create a scheduled task row if needed
            sync_method = config.get('sync_method', 'manual')
            sync_interval = config.get('sync_interval', 0)
            task_id = create_import_task_for_arr_config(
                config_id=new_config_id,
                config_name=config['name'],
                sync_method=sync_method,
                sync_interval=sync_interval)

            # 3) Update arr_config.import_task_id if a task was created
            if task_id:
                logger.debug(
                    f"[save_arr_config] Updating arr_config #{new_config_id} with import_task_id={task_id}"
                )
                cursor.execute(
                    'UPDATE arr_config SET import_task_id = ? WHERE id = ?',
                    (task_id, new_config_id))
                conn.commit()

            scheduler = TaskScheduler.get_instance()
            if scheduler:
                logger.debug("[save_arr_config] Reloading tasks from DB...")
                scheduler.load_tasks_from_db()

            return {'success': True, 'id': new_config_id}

        except Exception as e:
            logger.error(
                f"[save_arr_config] Error saving arr config: {str(e)}")
            return {'success': False, 'error': str(e)}


def update_arr_config(id, config):
    """
    Update an existing arr_config row, then create/update/remove the corresponding scheduled task as needed.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            # Check if name already exists (excluding current config)
            existing = cursor.execute(
                'SELECT id FROM arr_config WHERE name = ? AND id != ?',
                (config['name'], id)).fetchone()

            if existing:
                logger.warning(
                    f"[update_arr_config] Attempted to update config #{id} to duplicate name: {config['name']}"
                )
                return {
                    'success': False,
                    'error': 'Configuration with this name already exists',
                    'status_code': 409
                }

            # 1) Grab existing row so we know the existing import_task_id
            existing_row = cursor.execute(
                'SELECT * FROM arr_config WHERE id = ?', (id, )).fetchone()
            if not existing_row:
                logger.debug(
                    f"[update_arr_config] No arr_config row found with id={id}"
                )
                return {'success': False, 'error': 'Configuration not found'}

            existing_task_id = existing_row['import_task_id']

            # 2) Update the arr_config row itself
            logger.debug(
                f"[update_arr_config] Updating arr_config #{id} name={config['name']} sync_method={config.get('sync_method')}"
            )

            cursor.execute(
                '''
                UPDATE arr_config
                SET name = ?,
                    type = ?,
                    tags = ?,
                    arr_server = ?,
                    api_key = ?,
                    data_to_sync = ?,
                    sync_method = ?,
                    sync_interval = ?,
                    import_as_unique = ?
                WHERE id = ?
                ''',
                (config['name'], config['type'],
                 json.dumps(config.get('tags', [])), config['arrServer'],
                 config['apiKey'], json.dumps(config.get(
                     'data_to_sync', {})), config.get('sync_method', 'manual'),
                 config.get('sync_interval',
                            0), config.get('import_as_unique', False), id))
            conn.commit()
            if cursor.rowcount == 0:
                logger.debug(
                    f"[update_arr_config] arr_config #{id} not found for update"
                )
                return {'success': False, 'error': 'Configuration not found'}

            logger.info(f"[update_arr_config] Updated arr_config row #{id}")

            # 3) Create/Update/Remove the scheduled task row
            new_task_id = update_import_task_for_arr_config(
                config_id=id,
                config_name=config['name'],
                sync_method=config.get('sync_method', 'manual'),
                sync_interval=config.get('sync_interval', 0),
                existing_task_id=existing_task_id)

            # 4) Store new_task_id in arr_config.import_task_id
            logger.debug(
                f"[update_arr_config] Setting arr_config #{id} import_task_id to {new_task_id}"
            )
            cursor.execute(
                'UPDATE arr_config SET import_task_id = ? WHERE id = ?',
                (new_task_id, id))
            conn.commit()

            scheduler = TaskScheduler.get_instance()
            if scheduler:
                logger.debug("[update_arr_config] Reloading tasks from DB...")
                scheduler.load_tasks_from_db()

            return {'success': True}

        except Exception as e:
            logger.error(
                f"[update_arr_config] Error updating arr config: {str(e)}")
            return {'success': False, 'error': str(e)}


def delete_arr_config(id):
    """
    Delete an arr_config row, plus remove its scheduled_task if any.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            # 1) Fetch the row so we know which task to remove
            existing_row = cursor.execute(
                'SELECT * FROM arr_config WHERE id = ?', (id, )).fetchone()
            if not existing_row:
                logger.debug(
                    f"[delete_arr_config] No arr_config row found with id={id}"
                )
                return {'success': False, 'error': 'Configuration not found'}

            existing_task_id = existing_row['import_task_id']

            # 2) Delete the arr_config
            logger.debug(f"[delete_arr_config] Removing arr_config #{id}")
            cursor.execute('DELETE FROM arr_config WHERE id = ?', (id, ))
            conn.commit()
            if cursor.rowcount == 0:
                logger.debug(
                    f"[delete_arr_config] arr_config #{id} not found for deletion"
                )
                return {'success': False, 'error': 'Configuration not found'}

            logger.info(f"[delete_arr_config] Deleted arr_config #{id}")

            # 3) If there's a scheduled task, remove it
            if existing_task_id:
                delete_import_task_for_arr_config(existing_task_id)

            scheduler = TaskScheduler.get_instance()
            if scheduler:
                logger.debug("[delete_arr_config] Reloading tasks from DB...")
                scheduler.load_tasks_from_db()

            return {'success': True}

        except Exception as e:
            logger.error(
                f"[delete_arr_config] Error deleting arr config: {str(e)}")
            return {'success': False, 'error': str(e)}


def get_all_arr_configs():
    with get_db() as conn:
        cursor = conn.execute('SELECT * FROM arr_config')
        rows = cursor.fetchall()
        try:
            configs = []
            for row in rows:
                configs.append({
                    'id':
                    row['id'],
                    'name':
                    row['name'],
                    'type':
                    row['type'],
                    'tags':
                    json.loads(row['tags']) if row['tags'] else [],
                    'arrServer':
                    row['arr_server'],
                    'apiKey':
                    row['api_key'],
                    'data_to_sync': (json.loads(row['data_to_sync'])
                                     if row['data_to_sync'] else {}),
                    'last_sync_time':
                    row['last_sync_time'],
                    'sync_percentage':
                    row['sync_percentage'],
                    'sync_method':
                    row['sync_method'],
                    'sync_interval':
                    row['sync_interval'],
                    'import_as_unique':
                    bool(row['import_as_unique']),
                    'import_task_id':
                    row['import_task_id']
                })
            return {'success': True, 'data': configs}
        except Exception as e:
            logger.error(f"[get_all_arr_configs] Error: {str(e)}")
            return {'success': False, 'error': str(e)}


def get_arr_config(id):
    with get_db() as conn:
        cursor = conn.execute('SELECT * FROM arr_config WHERE id = ?', (id, ))
        row = cursor.fetchone()
        try:
            if row:
                return {
                    'success': True,
                    'data': {
                        'id':
                        row['id'],
                        'name':
                        row['name'],
                        'type':
                        row['type'],
                        'tags':
                        json.loads(row['tags']) if row['tags'] else [],
                        'arrServer':
                        row['arr_server'],
                        'apiKey':
                        row['api_key'],
                        'data_to_sync': (json.loads(row['data_to_sync'])
                                         if row['data_to_sync'] else {}),
                        'last_sync_time':
                        row['last_sync_time'],
                        'sync_percentage':
                        row['sync_percentage'],

                        # Keep these as-is
                        'sync_method':
                        row['sync_method'],
                        'sync_interval':
                        row['sync_interval'],
                        'import_as_unique':
                        bool(row['import_as_unique']),
                        'import_task_id':
                        row['import_task_id']
                    }
                }
            logger.debug(
                f"[get_arr_config] No arr_config row found with id={id}")
            return {'success': False, 'error': 'Configuration not found'}
        except Exception as e:
            logger.error(f"[get_arr_config] Error: {str(e)}")
            return {'success': False, 'error': str(e)}


def get_scheduled_configs():
    """
    Return all arr_configs where sync_method='schedule'.
    Potentially used if you want to see scheduled ones explicitly.
    """
    with get_db() as conn:
        cursor = conn.execute('SELECT * FROM arr_config WHERE sync_method = ?',
                              ('schedule', ))
        rows = cursor.fetchall()
        try:
            configs = []
            for row in rows:
                configs.append({
                    'id': row['id'],
                    'name': row['name'],
                    'sync_interval': row['sync_interval'],
                    'import_task_id': row['import_task_id']
                })
            return {'success': True, 'data': configs}
        except Exception as e:
            logger.error(f"[get_scheduled_configs] Error: {str(e)}")
            return {'success': False, 'error': str(e)}


def get_pull_configs():
    with get_db() as conn:
        rows = conn.execute(
            'SELECT * FROM arr_config WHERE sync_method = "pull"').fetchall()

        results = []
        for row in rows:
            results.append({
                'id':
                row['id'],
                'name':
                row['name'],
                'type':
                row['type'],
                'tags':
                json.loads(row['tags']) if row['tags'] else [],
                'arrServer':
                row['arr_server'],
                'apiKey':
                row['api_key'],
                'data_to_sync': (json.loads(row['data_to_sync'])
                                 if row['data_to_sync'] else {}),
                'last_sync_time':
                row['last_sync_time'],
                'sync_percentage':
                row['sync_percentage'],
                'sync_method':
                row['sync_method'],
                'sync_interval':
                row['sync_interval'],
                'import_as_unique':
                bool(row['import_as_unique']),
                'import_task_id':
                row['import_task_id']
            })
        return results


def check_active_sync_configs():
    """
    Check if there are any ARR configurations with non-manual sync methods.
    Returns (has_active_configs, details) tuple.
    """
    with get_db() as conn:
        cursor = conn.execute('''
            SELECT id, name, sync_method, data_to_sync 
            FROM arr_config 
            WHERE sync_method != 'manual'
        ''')
        active_configs = cursor.fetchall()

        if not active_configs:
            return False, None

        details = []
        for config in active_configs:
            data_to_sync = json.loads(
                config['data_to_sync'] if config['data_to_sync'] else '{}')
            if data_to_sync.get('profiles') or data_to_sync.get(
                    'customFormats'):
                details.append({
                    'id': config['id'],
                    'name': config['name'],
                    'sync_method': config['sync_method'],
                    'data': data_to_sync
                })

        return bool(details), details
