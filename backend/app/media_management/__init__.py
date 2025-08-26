from flask import Blueprint, jsonify, request
import logging
from .utils import (
    get_media_management_data,
    save_media_management_data,
    update_media_management_data,
    get_all_media_management_data,
    MEDIA_MANAGEMENT_CATEGORIES
)
from .sync import (
    sync_naming_config,
    sync_media_management_config,
    sync_quality_definitions
)
from ..arr.manager import get_arr_config

logger = logging.getLogger(__name__)

media_management_bp = Blueprint('media_management', __name__)


@media_management_bp.route('/api/media-management', methods=['GET'])
def get_all_media_management():
    """Get all media management data for all categories"""
    try:
        data = get_all_media_management_data()
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"Error retrieving media management data: {e}")
        return jsonify({'error': str(e)}), 500


@media_management_bp.route('/api/media-management/<category>', methods=['GET'])
def get_media_management(category):
    """Get media management data for a specific category"""
    if category not in MEDIA_MANAGEMENT_CATEGORIES:
        return jsonify({'error': f'Invalid category: {category}'}), 400
    
    try:
        data = get_media_management_data(category)
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"Error retrieving {category}: {e}")
        return jsonify({'error': str(e)}), 500


@media_management_bp.route('/api/media-management/<category>', methods=['PUT'])
def update_media_management(category):
    """Update media management data for a specific category"""
    if category not in MEDIA_MANAGEMENT_CATEGORIES:
        return jsonify({'error': f'Invalid category: {category}'}), 400
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        updated_data = update_media_management_data(category, data)
        return jsonify(updated_data), 200
    except Exception as e:
        logger.error(f"Error updating {category}: {e}")
        return jsonify({'error': str(e)}), 500


@media_management_bp.route('/api/media-management/sync', methods=['POST'])
def sync_media_management():
    """Sync media management data to arr instance"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        arr_id = data.get('arr_id')
        categories = data.get('categories', [])
        
        if not arr_id:
            return jsonify({'error': 'arr_id is required'}), 400
        
        if not categories:
            return jsonify({'error': 'categories list is required'}), 400
        
        # Validate categories
        invalid_categories = [cat for cat in categories if cat not in MEDIA_MANAGEMENT_CATEGORIES]
        if invalid_categories:
            return jsonify({'error': f'Invalid categories: {invalid_categories}'}), 400
        
        # Get arr config
        arr_result = get_arr_config(arr_id)
        if not arr_result.get('success'):
            return jsonify({'error': 'Arr configuration not found'}), 404
        
        arr_config = arr_result.get('data')
        base_url = arr_config['arrServer']
        api_key = arr_config['apiKey']
        arr_type = arr_config['type']
        
        results = {}
        
        # Sync each requested category
        for category in categories:
            try:
                # Get the current media management data for this category
                category_data = get_media_management_data(category)
                
                if category == 'naming':
                    arr_type_data = category_data.get(arr_type, {})
                    success, message = sync_naming_config(base_url, api_key, arr_type, arr_type_data)
                elif category == 'misc':
                    arr_type_data = category_data.get(arr_type, {})
                    success, message = sync_media_management_config(base_url, api_key, arr_type, arr_type_data)
                elif category == 'quality_definitions':
                    # Quality definitions has a nested structure: qualityDefinitions -> arr_type -> qualities
                    quality_defs = category_data.get('qualityDefinitions', {}).get(arr_type, {})
                    success, message = sync_quality_definitions(base_url, api_key, arr_type, quality_defs)
                else:
                    success, message = False, f"Unknown category: {category}"
                
                results[category] = {
                    'success': success,
                    'message': message
                }
                
            except Exception as e:
                logger.error(f"Error syncing {category}: {e}")
                results[category] = {
                    'success': False,
                    'message': str(e)
                }
        
        # Determine overall success
        overall_success = all(result['success'] for result in results.values())
        
        return jsonify({
            'success': overall_success,
            'results': results
        }), 200
        
    except Exception as e:
        logger.error(f"Error in media management sync: {e}")
        return jsonify({'error': str(e)}), 500