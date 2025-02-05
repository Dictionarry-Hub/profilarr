from flask import Blueprint, request, jsonify
import logging
import os
import yaml
from .utils import (get_category_directory, load_yaml_file, validate,
                    save_yaml_file, update_yaml_file, get_file_modified_date,
                    test_regex_pattern, test_format_conditions,
                    check_delete_constraints, filename_to_display)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
bp = Blueprint('data', __name__)


@bp.route('/<string:category>', methods=['GET'])
def retrieve_all(category):
    try:
        directory = get_category_directory(category)
        files = [f for f in os.listdir(directory) if f.endswith('.yml')]
        logger.debug(f"Found {len(files)} files in {category}")

        if not files:
            return jsonify([]), 200

        result = []
        errors = 0
        for file_name in files:
            file_path = os.path.join(directory, file_name)
            try:
                content = load_yaml_file(file_path)
                result.append({
                    "file_name":
                    file_name,
                    "content":
                    content,
                    "modified_date":
                    get_file_modified_date(file_path)
                })
            except yaml.YAMLError:
                errors += 1
                result.append({
                    "file_name": file_name,
                    "error": "Failed to parse YAML"
                })

        logger.info(
            f"Processed {len(files)} {category} files ({errors} errors)")
        return jsonify(result), 200

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
                os.remove(file_path)
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

                if validate(data, category):
                    save_yaml_file(file_path, data, category)
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

                if data and 'name' in data:
                    data['name'] = data['name'].strip()
                if data and 'rename' in data:
                    data['rename'] = data['rename'].strip()

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


@bp.route('/<string:category>/test', methods=['POST'])
def run_tests(category):
    logger.info(f"Received test request for category: {category}")

    try:
        data = request.get_json()
        if not data:
            logger.warning("Rejected test request - no JSON data provided")
            return jsonify({"error": "No JSON data provided"}), 400

        tests = data.get('tests', [])
        if not tests:
            logger.warning("Rejected test request - no test cases provided")
            return jsonify({"error":
                            "At least one test case is required"}), 400

        if category == 'regex_pattern':
            pattern = data.get('pattern')
            logger.info(f"Processing regex test request - Pattern: {pattern}")

            if not pattern:
                logger.warning("Rejected test request - missing pattern")
                return jsonify({"error": "Pattern is required"}), 400

            success, message, updated_tests = test_regex_pattern(
                pattern, tests)

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

        logger.info(f"Test execution completed - Success: {success}")

        if not success:
            logger.warning(f"Test execution failed - {message}")
            return jsonify({"success": False, "message": message}), 400

        return jsonify({"success": True, "tests": updated_tests}), 200

    except Exception as e:
        logger.warning(f"Unexpected error in test endpoint: {str(e)}",
                       exc_info=True)
        return jsonify({"success": False, "message": str(e)}), 500
