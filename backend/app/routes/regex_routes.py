from flask import Blueprint, request, jsonify
from app.utils.file_operations import REGEX_DIR, save_to_file, load_all_from_directory, delete_file, load_from_file
import json
import logging
import subprocess

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

        # Ensure testString is present
        if 'testString' not in request.json or not request.json['testString']:
            request.json['testString'] = "Sample test string"  # Add a default test string

        # Construct the data payload for curl
        data = json.dumps(request.json)
        curl_command = ["curl", "-s", "-X", "POST", "-H", "Content-Type: application/json", "-d", data, "https://regex101.com/api/regex"]

        # Execute the curl command
        response = subprocess.check_output(curl_command)

        # Log the response from regex101
        logging.debug(f"Response from regex101: {response.decode('utf-8')}")

        # Return the JSON response back to the frontend
        return jsonify(json.loads(response)), 200

    except subprocess.CalledProcessError as e:
        logging.error(f"cURL command failed: {str(e)}")
        return jsonify({"error": "Failed to connect to regex101"}), 500

    except Exception as e:
        logging.error(f"An unexpected error occurred: {str(e)}")
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