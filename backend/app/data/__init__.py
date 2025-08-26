from flask import Blueprint, request, jsonify
import logging
import os
import yaml
from .utils import (get_category_directory, load_yaml_file, validate,
                    save_yaml_file, update_yaml_file, get_file_modified_date,
                    test_regex_pattern, test_format_conditions,
                    check_delete_constraints, filename_to_display)
from ..db import add_format_to_renames, remove_format_from_renames, is_format_in_renames
from .cache import data_cache

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
bp = Blueprint('data', __name__)


@bp.route('/<string:category>', methods=['GET'])
def retrieve_all(category):
    try:
        # Use cache instead of reading from disk
        items = data_cache.get_all(category)
        
        # Add metadata for custom formats
        if category == 'custom_format':
            for item in items:
                if 'content' in item and 'name' in item['content']:
                    item['content']['metadata'] = {
                        'includeInRename': is_format_in_renames(item['content']['name'])
                    }
        
        logger.info(f"Retrieved {len(items)} {category} items from cache")
        return jsonify(items), 200

    except ValueError as ve:
        logger.error(ve)
        return jsonify({"error": str(ve)}), 400
    except FileNotFoundError as fnfe:
        logger.error(fnfe)
        return jsonify({"error": str(fnfe)}), 404
    except Exception as e:
        logger.exception("Unexpected error occurred")
        return jsonify({"error": "An unexpected error occurred"}), 500


@bp.route('/<string:category>/<string:name>',
          methods=['GET', 'POST', 'PUT', 'DELETE'])
def handle_item(category, name):
    try:
        directory = get_category_directory(category)
        file_name = f"{name}.yml" if not name.endswith('.yml') else name
        file_path = os.path.join(directory, file_name)

        if request.method == 'GET':
            try:
                content = load_yaml_file(file_path)
                # Add metadata for custom formats
                if category == 'custom_format':
                    content['metadata'] = {
                        'includeInRename':
                        is_format_in_renames(content['name'])
                    }
                return jsonify({
                    "file_name":
                    file_name,
                    "content":
                    content,
                    "modified_date":
                    get_file_modified_date(file_path)
                }), 200
            except FileNotFoundError:
                return jsonify({"error": f"File {file_name} not found"}), 404
            except yaml.YAMLError:
                return jsonify(
                    {"error": f"Failed to parse YAML file {file_name}"}), 500

        elif request.method == 'DELETE':
            if not os.path.exists(file_path):
                return jsonify({"error": f"File {file_name} not found"}), 404

            # Check for references before deleting
            can_delete, error_message = check_delete_constraints(
                category, filename_to_display(name))
            if not can_delete:
                logger.error(
                    f"Delete constraint check failed for {name}: {error_message}"
                )
                return jsonify({"error": error_message}), 409

            try:
                # If it's a custom format, remove from renames table first
                if category == 'custom_format':
                    # Get the format name from the file before deleting it
                    content = load_yaml_file(file_path)
                    format_name = content.get('name')
                    if format_name:
                        # Check if it exists in renames before trying to remove
                        if is_format_in_renames(format_name):
                            remove_format_from_renames(format_name)
                            logger.info(
                                f"Removed {format_name} from renames table")
                        else:
                            logger.info(
                                f"{format_name} was not in renames table")

                # Then delete the file
                os.remove(file_path)
                
                # Update cache
                data_cache.remove_item(category, file_name)
                
                return jsonify(
                    {"message": f"Successfully deleted {file_name}"}), 200
            except OSError as e:
                logger.error(f"Error deleting file {file_path}: {e}")
                return jsonify({"error": f"Failed to delete {file_name}"}), 500

        elif request.method == 'POST':
            # If a file already exists with that name, conflict
            if os.path.exists(file_path):
                return jsonify({"error":
                                f"File {file_name} already exists"}), 409

            try:
                data = request.get_json()

                if data and 'name' in data:
                    data['name'] = data['name'].strip()

                # Handle rename inclusion for custom formats
                if category == 'custom_format':
                    include_in_rename = data.get('metadata', {}).get(
                        'includeInRename', False)
                    # Remove metadata before saving YAML
                    if 'metadata' in data:
                        del data['metadata']

                if validate(data, category):
                    # Save YAML
                    save_yaml_file(file_path, data, category)

                    # If custom format, handle rename table
                    if category == 'custom_format' and include_in_rename:
                        add_format_to_renames(data['name'])

                    return jsonify(
                        {"message": f"Successfully created {file_name}"}), 201

                return jsonify({"error": "Validation failed"}), 400

            except Exception as e:
                logger.error(f"Error creating file: {e}")
                return jsonify({"error": str(e)}), 500

        elif request.method == 'PUT':
            if not os.path.exists(file_path):
                return jsonify({"error": f"File {file_name} not found"}), 404

            try:
                data = request.get_json()
                logger.info(f"Received PUT data for {name}: {data}")

                if data and 'name' in data:
                    data['name'] = data['name'].strip()
                if data and 'rename' in data:
                    data['rename'] = data['rename'].strip()

                # Handle rename inclusion for custom formats
                if category == 'custom_format':
                    include_in_rename = data.get('metadata', {}).get(
                        'includeInRename', False)

                    # Get current content to check for rename
                    current_content = load_yaml_file(file_path)
                    old_name = current_content.get('name')
                    new_name = data['name']

                    # Handle renames and toggles
                    if old_name != new_name and include_in_rename:
                        # Handle rename while keeping in table
                        remove_format_from_renames(old_name)
                        add_format_to_renames(new_name)
                    elif include_in_rename:
                        # Just turning it on
                        add_format_to_renames(new_name)
                    else:
                        # Turning it off
                        remove_format_from_renames(data['name'])

                    # Remove metadata before saving YAML
                    if 'metadata' in data:
                        del data['metadata']

                # Save YAML
                update_yaml_file(file_path, data, category)
                return jsonify(
                    {"message": f"Successfully updated {file_name}"}), 200

            except Exception as e:
                logger.error(f"Error updating file: {e}")
                return jsonify({"error": str(e)}), 500

    except ValueError as ve:
        logger.error(ve)
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.exception("Unexpected error occurred")
        return jsonify({"error": "An unexpected error occurred"}), 500


@bp.route('/regex/verify', methods=['POST'])
def verify_regex():
    """Verify a regex pattern using .NET regex engine via PowerShell"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        pattern = data.get('pattern')
        if not pattern:
            return jsonify({"error": "Pattern is required"}), 400
        
        from .utils import verify_dotnet_regex
        
        success, message = verify_dotnet_regex(pattern)
        
        if success:
            return jsonify({"valid": True, "message": "Pattern is valid"}), 200
        else:
            return jsonify({"valid": False, "error": message}), 200
    
    except Exception as e:
        logger.exception("Error verifying regex pattern")
        return jsonify({"valid": False, "error": str(e)}), 500


@bp.route('/<string:category>/test', methods=['POST'])
def run_tests(category):
    logger.info(f"Received test request for category: {category}")

    try:
        data = request.get_json()
        if not data:
            logger.warning("Test request rejected: no JSON data")
            return jsonify({"error": "No JSON data provided"}), 400

        tests = data.get('tests', [])
        if not tests:
            logger.warning("Test request rejected: no tests provided")
            return jsonify({"error":
                            "At least one test case is required"}), 400

        if category == 'regex_pattern':
            pattern = data.get('pattern')

            if not pattern:
                logger.warning("Test request rejected: missing pattern")
                return jsonify({"error": "Pattern is required"}), 400

            success, message, updated_tests = test_regex_pattern(
                pattern, tests)
            
            if success and updated_tests:
                passed = sum(1 for t in updated_tests if t.get('passes'))
                total = len(updated_tests)
                logger.info(f"Tests completed: {passed}/{total} passed")

        elif category == 'custom_format':
            conditions = data.get('conditions', [])
            logger.info(
                f"Processing format test request - Conditions: {len(conditions)}"
            )

            if not conditions:
                logger.warning(
                    "Rejected test request - no conditions provided")
                return jsonify({"error":
                                "At least one condition is required"}), 400

            success, message, updated_tests = test_format_conditions(
                conditions, tests)

        else:
            logger.warning(
                f"Rejected test request - invalid category: {category}")
            return jsonify(
                {"error": "Testing not supported for this category"}), 400

        if not success:
            logger.error(f"Test execution failed: {message}")
            return jsonify({"success": False, "message": message}), 400

        return jsonify({"success": True, "tests": updated_tests}), 200

    except Exception as e:
        logger.warning(f"Unexpected error in test endpoint: {str(e)}",
                       exc_info=True)
        return jsonify({"success": False, "message": str(e)}), 500
