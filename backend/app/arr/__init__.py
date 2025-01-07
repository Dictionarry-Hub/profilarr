from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import logging
from .status.ping import ping_service
from .manager import (save_arr_config, get_all_arr_configs, get_arr_config,
                      update_arr_config, delete_arr_config)

logger = logging.getLogger(__name__)
logger.setLevel(logging.ERROR)

bp = Blueprint('arr', __name__, url_prefix='/arr')


@bp.route('/ping', methods=['POST', 'OPTIONS'])
@cross_origin()
def ping():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.get_json()
    url = data.get('url')
    api_key = data.get('apiKey')
    arr_type = data.get('type')

    if not url or not api_key or not arr_type:
        return jsonify({
            'success': False,
            'error': 'URL, API key, and type are required'
        }), 400

    logger.error(f"Attempting to ping URL: {url} of type: {arr_type}")
    success, message = ping_service(url, api_key, arr_type)
    logger.error(f"Ping result - Success: {success}, Message: {message}")

    return jsonify({
        'success': success,
        'message': message
    }), 200 if success else 400


@bp.route('/config', methods=['POST', 'OPTIONS'])
@cross_origin()
def add_config():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    try:
        config = request.json
        result = save_arr_config(config)
        if not result['success']:
            return jsonify(result), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error saving arr config: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 400


@bp.route('/config', methods=['GET', 'OPTIONS'])
@cross_origin()
def get_configs():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    try:
        configs = get_all_arr_configs()
        logger.debug(f"Retrieved {len(configs)} arr configs")
        return jsonify(configs), 200
    except Exception as e:
        logger.error(f"Error getting arr configs: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 400


@bp.route('/config/<int:id>', methods=['GET', 'PUT', 'DELETE', 'OPTIONS'])
@cross_origin()
def handle_config(id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    try:
        if request.method == 'GET':
            config = get_arr_config(id)
            if config:
                logger.debug(f"Retrieved arr config: {id}")
                return jsonify({'success': True, 'data': config}), 200
            logger.debug(f"Arr config not found: {id}")
            return jsonify({
                'success': False,
                'error': 'Config not found'
            }), 404

        elif request.method == 'PUT':
            success = update_arr_config(id, request.json)
            if success:
                logger.debug(f"Updated arr config: {id}")
                return jsonify({'success': True}), 200
            logger.debug(f"Arr config not found for update: {id}")
            return jsonify({
                'success': False,
                'error': 'Config not found'
            }), 404

        elif request.method == 'DELETE':
            success = delete_arr_config(id)
            if success:
                logger.debug(f"Deleted arr config: {id}")
                return jsonify({'success': True}), 200
            logger.debug(f"Arr config not found for deletion: {id}")
            return jsonify({
                'success': False,
                'error': 'Config not found'
            }), 404

    except Exception as e:
        logger.error(f"Error handling arr config {id}: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 400
