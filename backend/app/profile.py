from flask import Blueprint, request, jsonify
from collections import OrderedDict
import os
import yaml
import logging
from .utils import get_next_id, generate_filename, get_current_timestamp, sanitize_input

bp = Blueprint('profile', __name__, url_prefix='/profile')
DATA_DIR = '/app/data'
PROFILE_DIR = os.path.join(DATA_DIR, 'db', 'profiles')

# Ensure the directory exists
os.makedirs(PROFILE_DIR, exist_ok=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@bp.route('', methods=['GET', 'POST'])
def handle_profiles():
    if request.method == 'POST':
        data = request.json
        saved_data = save_profile(data)
        return jsonify(saved_data), 201
    else:
        profiles = load_all_profiles()
        return jsonify(profiles)

@bp.route('/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def handle_profile(id):
    if request.method == 'GET':
        profile = load_profile(id)
        if profile:
            return jsonify(profile)
        return jsonify({"error": "Profile not found"}), 404
    elif request.method == 'PUT':
        data = request.json
        data['id'] = id
        saved_data = save_profile(data)
        return jsonify(saved_data)
    elif request.method == 'DELETE':
        if delete_profile(id):
            return jsonify({"message": f"Profile with ID {id} deleted."}), 200
        return jsonify({"error": f"Profile with ID {id} not found."}), 404

def save_profile(data):
    logger.info("Received data for saving profile: %s", data)

    # Sanitize and extract necessary fields
    name = sanitize_input(data.get('name', ''))
    description = sanitize_input(data.get('description', ''))
    profile_id = data.get('id', None)

    # Determine if this is a new profile or an existing one
    if profile_id == 0 or not profile_id:
        profile_id = get_next_id(PROFILE_DIR)
        logger.info("Assigned new profile ID: %d", profile_id)
        date_created = get_current_timestamp()
    else:
        existing_filename = os.path.join(PROFILE_DIR, f"{profile_id}.yml")
        if os.path.exists(existing_filename):
            existing_data = load_profile(profile_id)
            date_created = existing_data.get('date_created', get_current_timestamp())
        else:
            raise FileNotFoundError(f"No existing file found for ID: {profile_id}")

    date_modified = get_current_timestamp()

    # Process tags
    tags = [sanitize_input(tag) for tag in data.get('tags', [])]

    # Construct the ordered data
    ordered_data = OrderedDict([
        ('id', profile_id),
        ('name', name),
        ('description', description),
        ('date_created', str(date_created)),
        ('date_modified', str(date_modified)),
        ('tags', tags)
    ])

    # Generate the filename using only the ID
    filename = os.path.join(PROFILE_DIR, f"{profile_id}.yml")
    
    # Write to the file
    with open(filename, 'w') as file:
        yaml.dump(ordered_data, file, default_flow_style=False, Dumper=yaml.SafeDumper)
    
    return ordered_data

def load_profile(id):
    filename = os.path.join(PROFILE_DIR, f"{id}.yml")
    if os.path.exists(filename):
        with open(filename, 'r') as file:
            data = yaml.safe_load(file)
            return data
    return None

def load_all_profiles():
    profiles = []
    for filename in os.listdir(PROFILE_DIR):
        if filename.endswith('.yml'):
            with open(os.path.join(PROFILE_DIR, filename), 'r') as file:
                data = yaml.safe_load(file)
                profiles.append(data)
    return profiles

def delete_profile(id):
    filename = os.path.join(PROFILE_DIR, f"{id}.yml")
    if os.path.exists(filename):
        os.remove(filename)
        return True
    return False