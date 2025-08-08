"""Routes for the new import module."""
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import logging
from . import handle_import_request

logger = logging.getLogger(__name__)

bp = Blueprint('new_import', __name__)


@bp.route('', methods=['POST', 'OPTIONS'])
@cross_origin()
def import_items():
    """
    Import formats or profiles to an Arr instance.
    
    Request body:
    {
        "arrID": int,           # ID of arr_config to use
        "strategy": str,        # "format" or "profile"
        "filenames": [str],     # List of filenames to import
        "dryRun": bool          # Optional: simulate import without changes (default: false)
    }
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    try:
        data = request.get_json()
        
        # Validate request
        if not data:
            return jsonify({
                'success': False,
                'error': 'Request body is required'
            }), 400
        
        # Call the import handler
        result = handle_import_request(data)
        
        # Return appropriate status code
        if result.get('success'):
            return jsonify(result), 200
        else:
            # Check for specific error codes
            if 'not found' in result.get('error', '').lower():
                return jsonify(result), 404
            return jsonify(result), 400
            
    except Exception as e:
        logger.error(f"Error handling import request: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500