# app/importarr/__init__.py
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import logging
from pathlib import Path
from ..arr.manager import get_arr_config
from ..data.utils import get_category_directory, load_yaml_file
from .format import import_formats_to_arr
from .profile import import_profiles_to_arr

logger = logging.getLogger('importarr')

bp = Blueprint('import', __name__, url_prefix='/import')


@bp.route('/format', methods=['POST', 'OPTIONS'])
@cross_origin()
def import_formats():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    try:
        data = request.get_json()
        arr_id = data.get('arrId')
        all_formats = data.get('all', False)
        format_names = data.get('formatNames', [])

        if not arr_id:
            return jsonify({
                'success': False,
                'error': 'Arr ID is required'
            }), 400

        if not all_formats and not format_names:
            return jsonify({
                'success':
                False,
                'error':
                'Either formatNames or all=true is required'
            }), 400

        # Get arr configuration
        arr_config = get_arr_config(arr_id)
        if not arr_config['success']:
            return jsonify({
                'success': False,
                'error': 'Arr configuration not found'
            }), 404

        arr_data = arr_config['data']

        # If all=true, get all format names from the custom_format directory
        if all_formats:
            try:
                format_dir = Path(get_category_directory('custom_format'))
                format_names = [f.stem for f in format_dir.glob('*.yml')]
                if not format_names:
                    return jsonify({
                        'success': False,
                        'error': 'No custom formats found'
                    }), 404
            except Exception as e:
                logger.error(
                    f"Error reading custom formats directory: {str(e)}")
                return jsonify({
                    'success':
                    False,
                    'error':
                    'Failed to read custom formats directory'
                }), 500

        # Import formats with arr type from config
        result = import_formats_to_arr(format_names=format_names,
                                       base_url=arr_data['arrServer'],
                                       api_key=arr_data['apiKey'],
                                       arr_type=arr_data['type'])

        return jsonify(result), 200 if result['success'] else 400

    except Exception as e:
        logger.error(f"Error importing custom formats: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 400


@bp.route('/profile', methods=['POST', 'OPTIONS'])
@cross_origin()
def import_profiles():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    try:
        data = request.get_json()
        arr_id = data.get('arrId')
        all_profiles = data.get('all', False)
        profile_names = data.get('profileNames', [])

        if not arr_id:
            return jsonify({
                'success': False,
                'error': 'Arr ID is required'
            }), 400

        if not all_profiles and not profile_names:
            return jsonify({
                'success':
                False,
                'error':
                'Either profileNames or all=true is required'
            }), 400

        # Get arr configuration
        arr_config = get_arr_config(arr_id)
        if not arr_config['success']:
            return jsonify({
                'success': False,
                'error': 'Arr configuration not found'
            }), 404

        arr_data = arr_config['data']

        # If all=true, get all profile names
        if all_profiles:
            try:
                profile_dir = Path(get_category_directory('profile'))
                profile_names = [f.stem for f in profile_dir.glob('*.yml')]
                if not profile_names:
                    return jsonify({
                        'success': False,
                        'error': 'No quality profiles found'
                    }), 404
            except Exception as e:
                logger.error(f"Error reading profiles directory: {str(e)}")
                return jsonify({
                    'success': False,
                    'error': 'Failed to read profiles directory'
                }), 500

        logger.debug(
            f"Attempting to import profiles: {profile_names} for {arr_data['type']}: {arr_data['name']}"
        )

        # Get any custom formats referenced in these profiles
        format_names = set()
        for profile_name in profile_names:
            try:
                profile_file = f"{get_category_directory('profile')}/{profile_name}.yml"
                format_data = load_yaml_file(profile_file)
                for cf in format_data.get('custom_formats', []):
                    format_names.add(cf['name'])
            except Exception as e:
                logger.error(f"Error loading profile {profile_name}: {str(e)}")
                continue

        # Import/Update formats first - regardless of reported success since 202s are good
        if format_names:
            import_formats_to_arr(format_names=list(format_names),
                                  base_url=arr_data['arrServer'],
                                  api_key=arr_data['apiKey'],
                                  arr_type=arr_data['type'])

        # Import profiles
        result = import_profiles_to_arr(profile_names=profile_names,
                                        base_url=arr_data['arrServer'],
                                        api_key=arr_data['apiKey'],
                                        arr_type=arr_data['type'])

        return jsonify(result), 200 if result['success'] else 400

    except Exception as e:
        logger.error(f"Error importing quality profiles: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 400
