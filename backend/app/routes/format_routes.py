from flask import Blueprint, request, jsonify
from app.utils.format_operations import save_format, load_all_formats, delete_format, load_format

bp = Blueprint('format', __name__, url_prefix='/format')

@bp.route('', methods=['GET', 'POST'])
def handle_formats():
    if request.method == 'POST':
        data = request.json
        saved_data = save_format(data)
        return jsonify(saved_data), 201
    else:
        formats = load_all_formats()
        return jsonify(formats)

@bp.route('/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def handle_format(id):
    if request.method == 'GET':
        format = load_format(id)
        if format:
            return jsonify(format)
        return jsonify({"error": "Format not found"}), 404
    elif request.method == 'PUT':
        data = request.json
        data['id'] = id
        saved_data = save_format(data)
        return jsonify(saved_data)
    elif request.method == 'DELETE':
        if delete_format(id):
            return jsonify({"message": f"Format with ID {id} deleted."}), 200
        return jsonify({"error": f"Format with ID {id} not found."}), 404