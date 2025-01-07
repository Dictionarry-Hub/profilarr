# manager.py
from ..db import get_db
import json
import logging

logger = logging.getLogger(__name__)


def save_arr_config(config):
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                '''
                INSERT INTO arr_config (
                    name, type, tags, arr_server, api_key, 
                    data_to_sync, last_sync_time, sync_percentage,
                    sync_method, sync_interval, import_as_unique
                )
                VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?)
                ''',
                (config['name'], config['type'], json.dumps(
                    config['tags']), config['arrServer'], config['apiKey'],
                 json.dumps(config.get(
                     'data_to_sync', {})), config.get('sync_method', 'manual'),
                 config.get('sync_interval',
                            0), config.get('import_as_unique', False)))
            conn.commit()
            return {'success': True, 'id': cursor.lastrowid}
        except Exception as e:
            logger.error(f"Error saving arr config: {str(e)}")
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
                    'data_to_sync':
                    json.loads(row['data_to_sync'])
                    if row['data_to_sync'] else {},
                    'last_sync_time':
                    row['last_sync_time'],
                    'sync_percentage':
                    row['sync_percentage'],
                    'sync_method':
                    row['sync_method'],
                    'sync_interval':
                    row['sync_interval'],
                    'import_as_unique':
                    bool(row['import_as_unique'])
                })
            return {'success': True, 'data': configs}
        except Exception as e:
            logger.error(f"Error getting arr configs: {str(e)}")
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
                        'id': row['id'],
                        'name': row['name'],
                        'type': row['type'],
                        'tags': json.loads(row['tags']) if row['tags'] else [],
                        'arrServer': row['arr_server'],
                        'apiKey': row['api_key'],
                        'data_to_sync': json.loads(row['data_to_sync'])
                        if row['data_to_sync'] else {},
                        'last_sync_time': row['last_sync_time'],
                        'sync_percentage': row['sync_percentage'],
                        'sync_method': row['sync_method'],
                        'sync_interval': row['sync_interval'],
                        'import_as_unique': bool(row['import_as_unique'])
                    }
                }
            return {'success': False, 'error': 'Configuration not found'}
        except Exception as e:
            logger.error(f"Error getting arr config: {str(e)}")
            return {'success': False, 'error': str(e)}


def update_arr_config(id, config):
    with get_db() as conn:
        cursor = conn.cursor()
        try:
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
                (config['name'], config['type'], json.dumps(
                    config['tags']), config['arrServer'], config['apiKey'],
                 json.dumps(config.get(
                     'data_to_sync', {})), config.get('sync_method', 'manual'),
                 config.get('sync_interval',
                            0), config.get('import_as_unique', False), id))
            conn.commit()
            if cursor.rowcount > 0:
                return {'success': True}
            return {'success': False, 'error': 'Configuration not found'}
        except Exception as e:
            logger.error(f"Error updating arr config: {str(e)}")
            return {'success': False, 'error': str(e)}


def delete_arr_config(id):
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute('DELETE FROM arr_config WHERE id = ?', (id, ))
            conn.commit()
            if cursor.rowcount > 0:
                return {'success': True}
            return {'success': False, 'error': 'Configuration not found'}
        except Exception as e:
            logger.error(f"Error deleting arr config: {str(e)}")
            return {'success': False, 'error': str(e)}


def get_scheduled_configs():
    """Get all configurations that use scheduled sync method"""
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
                    'sync_interval': row['sync_interval']
                })
            return {'success': True, 'data': configs}
        except Exception as e:
            logger.error(f"Error getting scheduled configs: {str(e)}")
            return {'success': False, 'error': str(e)}


def get_pull_configs():
    """Get all configurations that use pull sync method"""
    with get_db() as conn:
        cursor = conn.execute('SELECT * FROM arr_config WHERE sync_method = ?',
                              ('pull', ))
        rows = cursor.fetchall()
        try:
            configs = []
            for row in rows:
                configs.append({'id': row['id'], 'name': row['name']})
            return {'success': True, 'data': configs}
        except Exception as e:
            logger.error(f"Error getting pull configs: {str(e)}")
            return {'success': False, 'error': str(e)}
