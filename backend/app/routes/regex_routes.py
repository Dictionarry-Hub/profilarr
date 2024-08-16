from flask import Blueprint, request, jsonify
from app.utils.regex_operations import save_regex, load_all_regexes, delete_regex, load_regex
from app.utils.format_operations import load_all_formats
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
        required_fields = ['regex', 'delimiter', 'flavor']
        for field in required_fields:
            if field not in request.json:
                logging.error(f"Missing required field: {field}")
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Set default flags to 'gmi' for global, multiline, and case-insensitive matching
        request.json['flags'] = 'gmi'

        # Include a separate test string if not provided
        if 'testString' not in request.json:
            request.json['testString'] = "Sample test string"

        # Always include unit tests with every request
        request.json['unitTests'] = [
            {
                "description": "Sample DOES_MATCH test",
                "testString": request.json['testString'],  # Use the main test string
                "criteria": "DOES_MATCH",
                "target": "REGEX"
            },
            {
                "description": "Sample DOES_NOT_MATCH test",
                "testString": "Non-matching string",  # This should not match the regex
                "criteria": "DOES_NOT_MATCH",
                "target": "REGEX"
            }
        ]

        # Log the complete payload before sending
        logging.debug(f"Final payload being sent to Regex101 API: {json.dumps(request.json, indent=2)}")

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
def handle_regexes():
    if request.method == 'POST':
        data = request.json
        saved_data = save_regex(data)
        return jsonify(saved_data), 201
    else:
        regexes = load_all_regexes()
        return jsonify(regexes)

@bp.route('/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def handle_regex(id):
    if request.method == 'GET':
        regex = load_regex(id)
        if regex:
            return jsonify(regex)
        return jsonify({"error": "Regex not found"}), 404
    elif request.method == 'PUT':
        data = request.json
        data['id'] = id
        saved_data = save_regex(data)
        return jsonify(saved_data)
    elif request.method == 'DELETE':
        # Check if the regex is used in any custom formats
        formats_using_regex = [format for format in load_all_formats() if any(condition.get('regex_id') == id for condition in format.get('conditions', []))]
        if formats_using_regex:
            return jsonify({"error": "Regex in use"}), 409  # 409 Conflict if in use

        if delete_regex(id):
            return jsonify({"message": f"Regex with ID {id} deleted."}), 200
        return jsonify({"error": f"Regex with ID {id} not found."}), 404