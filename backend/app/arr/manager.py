from ..db import get_db
import json
import logging

logger = logging.getLogger(__name__)


def save_arr_config(config):
    """Save a new arr configuration"""
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                '''
                INSERT INTO arr_config (name, type, tags, profilarr_server, arr_server, api_key)
                VALUES (?, ?, ?, ?, ?, ?)
                ''', (config['name'], config['type'], json.dumps(
                    config['tags']), config['profilarrServer'],
                      config['arrServer'], config['apiKey']))
            conn.commit()
            return {'success': True, 'id': cursor.lastrowid}
        except Exception as e:
            logger.error(f"Error saving arr config: {str(e)}")
            return {'success': False, 'error': str(e)}


def get_all_arr_configs():
    """Get all arr configurations"""
    with get_db() as conn:
        cursor = conn.execute('SELECT * FROM arr_config')
        rows = cursor.fetchall()
        try:
            configs = [{
                'id': row['id'],
                'name': row['name'],
                'type': row['type'],
                'tags': json.loads(row['tags']),
                'profilarrServer': row['profilarr_server'],
                'arrServer': row['arr_server'],
                'apiKey': row['api_key']
            } for row in rows]
            response = {'success': True, 'data': configs}
            logger.debug(f"Sending response: {response}")
            return response
        except Exception as e:
            logger.error(f"Error getting arr configs: {str(e)}")
            return {'success': False, 'error': str(e)}


def get_arr_config(id):
    """Get a specific arr configuration"""
    with get_db() as conn:
        cursor = conn.execute('SELECT * FROM arr_config WHERE id = ?', (id, ))
        row = cursor.fetchone()
        try:
            if row:
                config = {
                    'id': row['id'],
                    'name': row['name'],
                    'type': row['type'],
                    'tags': json.loads(row['tags']),
                    'profilarrServer': row['profilarr_server'],
                    'arrServer': row['arr_server'],
                    'apiKey': row['api_key']
                }
                return {'success': True, 'data': config}
            return {'success': False, 'error': 'Configuration not found'}
        except Exception as e:
            logger.error(f"Error getting arr config: {str(e)}")
            return {'success': False, 'error': str(e)}


def update_arr_config(id, config):
    """Update an existing arr configuration"""
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                '''
                UPDATE arr_config
                SET name = ?, type = ?, tags = ?, profilarr_server = ?, arr_server = ?, api_key = ?
                WHERE id = ?
                ''', (config['name'], config['type'], json.dumps(
                    config['tags']), config['profilarrServer'],
                      config['arrServer'], config['apiKey'], id))
            conn.commit()
            if cursor.rowcount > 0:
                return {'success': True}
            return {'success': False, 'error': 'Configuration not found'}
        except Exception as e:
            logger.error(f"Error updating arr config: {str(e)}")
            return {'success': False, 'error': str(e)}


def delete_arr_config(id):
    """Delete an arr configuration"""
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
