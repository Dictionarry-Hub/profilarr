from flask import Blueprint, jsonify, request
import logging
from .utils import (
    get_media_management_data,
    save_media_management_data,
    update_media_management_data,
    get_all_media_management_data,
    MEDIA_MANAGEMENT_CATEGORIES
)

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