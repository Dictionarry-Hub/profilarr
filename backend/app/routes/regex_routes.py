from flask import Blueprint, request, jsonify
from app.utils.file_operations import REGEX_DIR, save_to_file, load_all_from_directory, delete_file, load_from_file
import requests
import logging

bp = Blueprint('regex', __name__, url_prefix='/regex')
logging.basicConfig(level=logging.DEBUG)

@bp.route('/regex101', methods=['POST'])
def regex101_proxy():
    try:
        # Log the incoming request data
        logging.debug(f"Received data from frontend: {request.json}")

        # Validate the request data before sending
        required_fields = ['regex', 'flags', 'delimiter', 'flavor']
        for field in required_fields:
            if field not in request.json:
                logging.error(f"Missing required field: {field}")
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Send the POST request to regex101 with a timeout
        response = requests.post('https://regex101.com/api/regex', json=request.json, timeout=10)

        # Log the response from regex101
        logging.debug(f"Response from regex101: {response.text}")

        # Return the JSON response and status code back to the frontend
        return jsonify(response.json()), response.status_code

    except requests.RequestException as e:
        # Log the exception details
        logging.error(f"Request to regex101 failed: {e}")
        return jsonify({"error": "Failed to connect to regex101"}), 500

    except Exception as e:
        # Log any other exception that might occur
        logging.error(f"An unexpected error occurred: {e}")
        return jsonify({"error": "An unexpected error occurred"}), 500

@bp.route('', methods=['GET', 'POST'])
def handle_items():
    if request.method == 'POST':
        data = request.json
        # Ensure regex101Link is included in the data
        if 'regex101Link' not in data:
            data['regex101Link'] = ''
        saved_data = save_to_file(REGEX_DIR, data)
        return jsonify(saved_data), 201
    else:
        items = load_all_from_directory(REGEX_DIR)
        return jsonify(items)

@bp.route('/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def handle_item(id):
    if request.method == 'GET':
        item = load_from_file(REGEX_DIR, id)
        if item:
            return jsonify(item)
        return jsonify({"error": "Item not found"}), 404
    elif request.method == 'PUT':
        data = request.json
        data['id'] = id
        # Ensure regex101Link is included in the data
        if 'regex101Link' not in data:
            data['regex101Link'] = ''
        saved_data = save_to_file(REGEX_DIR, data)
        return jsonify(saved_data)
    elif request.method == 'DELETE':
        if delete_file(REGEX_DIR, id):
            return jsonify({"message": f"Item with ID {id} deleted."}), 200
        return jsonify({"error": f"Item with ID {id} not found."}), 404