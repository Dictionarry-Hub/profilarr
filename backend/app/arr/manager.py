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
                delete_import_task_for_arr_config(existing_task_id,
                                                  config_id=id)

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


def run_import_for_config(config_row):
    """
    Perform the same import logic as the /import endpoints, but automatically
    for a "pull-based" or "schedule-based" ARR config.

    We'll calculate a 'real' percentage based on how many items
    (formats + profiles) we attempted to import.
    """

    from datetime import datetime
    from ..db import get_db

    arr_id = config_row['id']
    arr_name = config_row['name']
    arr_type = config_row['type']
    arr_server = config_row['arrServer']
    api_key = config_row['apiKey']

    logger.info(
        f"[Pull Import] Running import for ARR config #{arr_id} ({arr_name})")

    # Safely parse data_to_sync
    data_to_sync = config_row['data_to_sync'] or {}

    selected_profiles = data_to_sync.get('profiles', [])
    selected_formats = data_to_sync.get('customFormats', [])

    # We'll count how many 'items' total we plan to import
    # (each selected format + each referenced format + each selected profile).
    # Then after each step, we'll increment done_steps by however many items we actually imported.
    total_steps = 0
    total_steps += len(selected_formats)
    referenced_cf_names = set()
    total_steps += len(selected_profiles)  # profiles themselves

    # We'll discover referenced formats in a moment; we don't know how many yet,
    # so we'll add them to total_steps once we parse them.

    # 1) Import user-selected custom formats
    done_steps = 0
    if selected_formats:
        logger.info(
            f"[Pull Import] Importing {len(selected_formats)} user-selected CFs for ARR #{arr_id}"
        )
        try:
            from ..importarr.format import import_formats_to_arr
            format_result = import_formats_to_arr(
                format_names=selected_formats,
                base_url=arr_server,
                api_key=api_key,
                arr_type=arr_type)
            if not format_result.get('success'):
                logger.warning(
                    f"[Pull Import] Importing user-selected CFs for ARR #{arr_id} had errors: {format_result}"
                )
        except Exception as e:
            logger.exception(
                f"[Pull Import] Failed importing user-selected CFs for ARR #{arr_id}: {str(e)}"
            )
        # Assume all selected formats were "attempted" => add them to done_steps
        done_steps += len(selected_formats)

    # 2) For user-selected profiles, gather any referenced CFs
    if selected_profiles:
        from pathlib import Path
        from ..data.utils import get_category_directory, load_yaml_file

        for profile_name in selected_profiles:
            try:
                profile_file = Path(
                    get_category_directory('profile')) / f"{profile_name}.yml"
                if not profile_file.exists():
                    logger.warning(
                        f"[Pull Import] Profile file not found: {profile_file}"
                    )
                    continue

                profile_data = load_yaml_file(str(profile_file))
                for cf in profile_data.get('custom_formats', []):
                    if 'name' in cf:
                        referenced_cf_names.add(cf['name'])
            except Exception as e:
                logger.error(
                    f"[Pull Import] Error loading profile {profile_name}: {str(e)}"
                )
                continue

    # Add the discovered referenced custom formats to total_steps
    total_steps += len(referenced_cf_names)

    # 2b) Import CFs referenced by profiles (safe even if some are duplicates of user-selected)
    if referenced_cf_names:
        logger.info(
            f"[Pull Import] Importing {len(referenced_cf_names)} CFs referenced by profiles for ARR #{arr_id}"
        )
        try:
            from ..importarr.format import import_formats_to_arr
            cf_result = import_formats_to_arr(
                format_names=list(referenced_cf_names),
                base_url=arr_server,
                api_key=api_key,
                arr_type=arr_type)
            if not cf_result.get('success'):
                logger.warning(
                    f"[Pull Import] Importing CFs referenced by profiles for ARR #{arr_id} had errors: {cf_result}"
                )
        except Exception as e:
            logger.exception(
                f"[Pull Import] Failed importing referenced CFs for ARR #{arr_id}: {str(e)}"
            )
        done_steps += len(referenced_cf_names)

    # 3) Import the profiles themselves
    if selected_profiles:
        logger.info(
            f"[Pull Import] Importing {len(selected_profiles)} profiles for ARR #{arr_id}"
        )
        try:
            from ..importarr.profile import import_profiles_to_arr
            profile_result = import_profiles_to_arr(
                profile_names=selected_profiles,
                base_url=arr_server,
                api_key=api_key,
                arr_type=arr_type,
                arr_id=arr_id)
            if not profile_result.get('success'):
                logger.warning(
                    f"[Pull Import] Importing profiles for ARR #{arr_id} had errors: {profile_result}"
                )
        except Exception as e:
            logger.exception(
                f"[Pull Import] Failed importing profiles for ARR #{arr_id}: {str(e)}"
            )
        done_steps += len(selected_profiles)

    # 4) Calculate real percentage
    if total_steps > 0:
        sync_percentage = int((done_steps / total_steps) * 100)
    else:
        # If no items were selected at all, consider it "fully synced"
        sync_percentage = 100

    logger.info(
        f"[Pull Import] Done importing for ARR config #{arr_id} ({arr_name}). "
        f"Progress: {done_steps}/{total_steps} => {sync_percentage}%")

    # 5) Update arr_config with last_sync_time + final sync_percentage
    now = datetime.now()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            '''
            UPDATE arr_config
            SET last_sync_time = ?,
                sync_percentage = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            ''', (now, sync_percentage, arr_id))
        conn.commit()

    logger.info(
        f"[Pull Import] Updated ARR config #{arr_id} last_sync_time={now} & sync_percentage={sync_percentage}."
    )
