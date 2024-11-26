from flask import Blueprint, request, jsonify
import logging
import os
import yaml
from .utils import (get_category_directory, load_yaml_file, validate,
                    save_yaml_file, update_yaml_file, get_file_created_date,
                    get_file_modified_date)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
bp = Blueprint('data', __name__, url_prefix='/data')


@bp.route('/<string:category>', methods=['GET'])
def retrieve_all(category):
    try:
        directory = get_category_directory(category)
        files = [f for f in os.listdir(directory) if f.endswith('.yml')]
        logger.info(f"Files found: {files}")

        if not files:
            return jsonify([]), 200

        result = []
        for file_name in files:
            file_path = os.path.join(directory, file_name)
            logger.info(f"Processing file: {file_path}")
            try:
                content = load_yaml_file(file_path)
                result.append({
                    "file_name":
                    file_name,
                    "content":
                    content,
                    "created_date":
                    get_file_created_date(file_path),
                    "modified_date":
                    get_file_modified_date(file_path)
                })
            except yaml.YAMLError:
                result.append({
                    "file_name": file_name,
                    "error": "Failed to parse YAML"
                })

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
                    "created_date":
                    get_file_created_date(file_path),
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
            try:
                os.remove(file_path)
                return jsonify(
                    {"message": f"Successfully deleted {file_name}"}), 200
            except OSError as e:
                logger.error(f"Error deleting file {file_path}: {e}")
                return jsonify({"error": f"Failed to delete {file_name}"}), 500

        elif request.method == 'POST':
            if os.path.exists(file_path):
                return jsonify({"error":
                                f"File {file_name} already exists"}), 409

            try:
                data = request.get_json()
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
