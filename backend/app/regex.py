from flask import Blueprint, request, jsonify
from collections import OrderedDict
import os
import yaml
import json
import logging
import subprocess
from .utils import get_next_id, generate_filename, get_current_timestamp, sanitize_input
from .format import load_all_formats

bp = Blueprint('regex', __name__, url_prefix='/regex')
DATA_DIR = '/app/data'
REGEX_DIR = os.path.join(DATA_DIR, 'db', 'regex_patterns')
logging.basicConfig(level=logging.DEBUG)

# Ensure the directory exists
os.makedirs(REGEX_DIR, exist_ok=True)

@bp.route('/regex101', methods=['POST'])
def regex101_proxy():
    try:
        logging.debug(f"Received data from frontend: {request.json}")

        required_fields = ['regex', 'delimiter', 'flavor']
        for field in required_fields:
            if field not in request.json:
                logging.error(f"Missing required field: {field}")
                return jsonify({"error": f"Missing required field: {field}"}), 400

        request.json['flags'] = 'gmi'

        if 'testString' not in request.json:
            request.json['testString'] = "Sample test string"

        request.json['unitTests'] = [
            {
                "description": "Sample DOES_MATCH test",
                "testString": request.json['testString'],
                "criteria": "DOES_MATCH",
                "target": "REGEX"
            },
            {
                "description": "Sample DOES_NOT_MATCH test",
                "testString": "Non-matching string",
                "criteria": "DOES_NOT_MATCH",
                "target": "REGEX"
            }
        ]

        logging.debug(f"Final payload being sent to Regex101 API: {json.dumps(request.json, indent=2)}")

        data = json.dumps(request.json)
        curl_command = ["curl", "-s", "-X", "POST", "-H", "Content-Type: application/json", "-d", data, "https://regex101.com/api/regex"]

        response = subprocess.check_output(curl_command)

        logging.debug(f"Response from regex101: {response.decode('utf-8')}")

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
        result = delete_regex(id)
        if "error" in result:
            return jsonify(result), 400
        return jsonify(result), 200

def save_regex(data):
    ordered_data = OrderedDict()

    if 'id' in data and data['id'] != 0:  # Editing an existing regex
        ordered_data['id'] = data['id']
        existing_filename = os.path.join(REGEX_DIR, f"{ordered_data['id']}.yml")
        logging.debug(f"Existing filename determined: {existing_filename}")
        
        # Check if the existing file actually exists
        if os.path.exists(existing_filename):
            existing_data = load_regex(ordered_data['id'])
            if existing_data:
                ordered_data['date_created'] = existing_data.get('date_created', get_current_timestamp())
            else:
                raise FileNotFoundError(f"Failed to load existing data for ID: {ordered_data['id']}")
        else:
            raise FileNotFoundError(f"No existing file found for ID: {ordered_data['id']}")
    else:  # New regex
        ordered_data['id'] = get_next_id(REGEX_DIR)
        ordered_data['date_created'] = get_current_timestamp()
        logging.debug(f"New regex being created with ID: {ordered_data['id']}")

    # Fill in other details in the desired order
    ordered_data['name'] = sanitize_input(data.get('name', ''))
    ordered_data['description'] = sanitize_input(data.get('description', ''))
    ordered_data['tags'] = [sanitize_input(tag) for tag in data.get('tags', [])]
    ordered_data['pattern'] = data.get('pattern', '')  # Store pattern as-is
    ordered_data['regex101Link'] = data.get('regex101Link', '')
    ordered_data['date_created'] = ordered_data.get('date_created', get_current_timestamp())
    ordered_data['date_modified'] = get_current_timestamp()

    # Always use the ID as the filename
    new_filename = os.path.join(REGEX_DIR, f"{ordered_data['id']}.yml")
    
    logging.debug(f"Filename to be used: {new_filename}")

    # Save the updated data to the file, writing each field in the specified order
    with open(new_filename, 'w') as file:
        file.write(f"id: {ordered_data['id']}\n")
        file.write(f"name: '{ordered_data['name']}'\n")
        file.write(f"description: '{ordered_data['description']}'\n")
        file.write(f"tags:\n")
        for tag in ordered_data['tags']:
            file.write(f"  - {tag}\n")
        file.write(f"pattern: '{ordered_data['pattern']}'\n")
        file.write(f"regex101Link: '{ordered_data['regex101Link']}'\n")
        file.write(f"date_created: '{ordered_data['date_created']}'\n")
        file.write(f"date_modified: '{ordered_data['date_modified']}'\n")
    
    logging.debug(f"File saved: {new_filename}")

    return ordered_data

def is_regex_used_in_format(regex_id):
    formats = load_all_formats()
    for format in formats:
        for condition in format.get('conditions', []):
            if condition.get('type') == 'regex' and condition.get('regex_id') == regex_id:
                return True
    return False

def find_existing_file(regex_id):
    """Find the existing filename for a given regex ID."""
    files = [f for f in os.listdir(REGEX_DIR) if f.startswith(f"{regex_id}_") and f.endswith('.yml')]
    if files:
        logging.debug(f"Existing file found: {files[0]}")
        return os.path.join(REGEX_DIR, files[0])
    logging.debug(f"No existing file found for ID: {regex_id}")
    return None

def load_regex(id):
    filename = os.path.join(REGEX_DIR, f"{id}.yml")
    if os.path.exists(filename):
        with open(filename, 'r') as file:
            data = yaml.safe_load(file)
            return data
    return None


def load_all_regexes():
    regexes = []
    for filename in os.listdir(REGEX_DIR):
        if filename.endswith('.yml'):
            with open(os.path.join(REGEX_DIR, filename), 'r') as file:
                data = yaml.safe_load(file)
                regexes.append(data)
    return regexes

def delete_regex(id):
    if is_regex_used_in_format(id):
        return {"error": "Regex in use", "message": "This regex is being used in one or more custom formats."}
    
    filename = os.path.join(REGEX_DIR, f"{id}.yml")
    if os.path.exists(filename):
        os.remove(filename)
        return {"message": f"Regex with ID {id} deleted."}
    return {"error": f"Regex with ID {id} not found."}