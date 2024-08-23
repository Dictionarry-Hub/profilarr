from flask import Blueprint, request, jsonify
from collections import OrderedDict
import os
import yaml
import logging
from .utils import get_next_id, generate_filename, get_current_timestamp, sanitize_input
from .data_operations import load_all_profiles, load_all_formats

bp = Blueprint('format', __name__, url_prefix='/format')
DATA_DIR = '/app/data'
FORMAT_DIR = os.path.join(DATA_DIR, 'db', 'custom_formats')

# Ensure the directory exists
os.makedirs(FORMAT_DIR, exist_ok=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
        result = delete_format(id)
        if "error" in result:
            return jsonify(result), 400
        return jsonify(result), 200

def is_format_used_in_profile(format_id):
    profiles = load_all_profiles()
    for profile in profiles:
        for custom_format in profile.get('custom_formats', []):
            if custom_format.get('id') == format_id and custom_format.get('score', 0) != 0:
                return True
    return False

def save_format(data):
    logger.info("Received data for saving format: %s", data)

    # Sanitize and extract necessary fields
    name = sanitize_input(data.get('name', ''))
    description = sanitize_input(data.get('description', ''))
    format_id = data.get('id', None)

    # Determine if this is a new format or an existing one
    if format_id == 0 or not format_id:
        format_id = get_next_id(FORMAT_DIR)
        logger.info("Assigned new format ID: %d", format_id)
        date_created = get_current_timestamp()
    else:
        existing_filename = os.path.join(FORMAT_DIR, f"{format_id}.yml")
        if os.path.exists(existing_filename):
            existing_data = load_format(format_id)
            date_created = existing_data.get('date_created', get_current_timestamp())
        else:
            raise FileNotFoundError(f"No existing file found for ID: {format_id}")

    date_modified = get_current_timestamp()

    # Process conditions
    conditions = []
    for condition in data.get('conditions', []):
        logger.info("Processing condition: %s", condition)
        cond_dict = OrderedDict([
            ('type', condition['type']),
            ('name', sanitize_input(condition['name'])),
            ('negate', condition.get('negate', False)),
            ('required', condition.get('required', False))
        ])
        if condition['type'] == 'regex':
            cond_dict['regex_id'] = condition['regex_id']
        elif condition['type'] == 'size':
            cond_dict['min'] = condition['min']
            cond_dict['max'] = condition['max']
        elif condition['type'] == 'flag':
            cond_dict['flag'] = sanitize_input(condition['flag'])
        conditions.append(cond_dict)

    # Process tags
    tags = [sanitize_input(tag) for tag in data.get('tags', [])]

    # Construct the ordered data
    ordered_data = OrderedDict([
        ('id', format_id),
        ('name', name),
        ('description', description),
        ('date_created', str(date_created)),
        ('date_modified', str(date_modified)),
        ('conditions', conditions),
        ('tags', tags)
    ])

    # Generate the filename using only the ID
    filename = os.path.join(FORMAT_DIR, f"{format_id}.yml")
    
    # Write to the file
    with open(filename, 'w') as file:
        yaml.dump(ordered_data, file, default_flow_style=False, Dumper=yaml.SafeDumper)
    
    return ordered_data

def load_format(id):
    filename = os.path.join(FORMAT_DIR, f"{id}.yml")
    if os.path.exists(filename):
        with open(filename, 'r') as file:
            data = yaml.safe_load(file)
            return data
    return None

def delete_format(id):
    if is_format_used_in_profile(id):
        return {"error": "Format in use", "message": "This format is being used in one or more profiles."}
    
    filename = os.path.join(FORMAT_DIR, f"{id}.yml")
    if os.path.exists(filename):
        os.remove(filename)
        return {"message": f"Format with ID {id} deleted."}
    return {"error": f"Format with ID {id} not found."}