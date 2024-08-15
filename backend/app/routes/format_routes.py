# app/routes/format_routes.py

from flask import Blueprint, request, jsonify
from app.utils.file_operations import FORMAT_DIR, REGEX_DIR, save_to_file, load_all_from_directory, delete_file, load_from_file

bp = Blueprint('format', __name__, url_prefix='/format')  

@bp.route('', methods=['GET', 'POST'])
def handle_items():
    if request.method == 'POST':
        data = request.json
        saved_data = save_to_file(FORMAT_DIR, data)
        return jsonify(saved_data), 201
    else:
        items = load_all_from_directory(FORMAT_DIR)
        return jsonify(items)

@bp.route('/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def handle_item(id):
    if request.method == 'GET':
        item = load_from_file(FORMAT_DIR, id)
        if item:
            return jsonify(item)
        return jsonify({"error": "Item not found"}), 404
    elif request.method == 'PUT':
        data = request.json
        data['id'] = id
        saved_data = save_to_file(FORMAT_DIR, data)
        return jsonify(saved_data)
    elif request.method == 'DELETE':
        if delete_file(FORMAT_DIR, id):
            return jsonify({"message": f"Item with ID {id} deleted."}), 200
        return jsonify({"error": f"Item with ID {id} not found."}), 404