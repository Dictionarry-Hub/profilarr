import os
import yaml
import re
import logging
from collections import OrderedDict
from .file_utils import get_next_id, generate_filename, get_current_timestamp

FORMAT_DIR = 'custom_formats'

# Set up basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def represent_ordereddict(dumper, data):
    return dumper.represent_mapping('tag:yaml.org,2002:map', data.items())

yaml.add_representer(OrderedDict, represent_ordereddict, Dumper=yaml.SafeDumper)

def sanitize_input(input_str):
    # Trim leading/trailing whitespace
    sanitized_str = input_str.strip()

    # Replace special characters that could affect YAML formatting
    sanitized_str = re.sub(r'[:#\-\*>\|&]', '', sanitized_str)

    # Ensure there are no tabs (which can cause issues in YAML)
    sanitized_str = sanitized_str.replace('\t', ' ')

    # Optionally: Collapse multiple spaces into a single space
    sanitized_str = re.sub(r'\s+', ' ', sanitized_str)

    return sanitized_str

def save_format(data):
    # Log the received data
    logger.info("Received data for saving format: %s", data)

    # Sanitize inputs
    name = sanitize_input(data.get('name', ''))
    description = sanitize_input(data.get('description', ''))

    # Determine if it's a new format or an edit
    format_id = data.get('id', None)
    if format_id == 0:  # If id is 0, treat it as a new format
        format_id = get_next_id(FORMAT_DIR)
        logger.info("Assigned new format ID: %d", format_id)
        date_created = get_current_timestamp()
    else:
        existing_data = load_format(format_id)
        if existing_data:
            date_created = existing_data.get('date_created')
            old_filename = generate_filename(FORMAT_DIR, format_id, existing_data['name'])
            # Delete the old file
            if os.path.exists(old_filename):
                os.remove(old_filename)
        else:
            date_created = get_current_timestamp()

    date_modified = get_current_timestamp()

    # Prepare conditions
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

    # Prepare tags
    tags = [sanitize_input(tag) for tag in data.get('tags', [])]

    # Create ordered data dictionary
    ordered_data = OrderedDict([
        ('id', format_id),
        ('name', name),
        ('description', description),
        ('date_created', str(date_created)),
        ('date_modified', str(date_modified)),
        ('conditions', conditions),
        ('tags', tags)
    ])

    # Generate new filename based on the updated name
    new_filename = generate_filename(FORMAT_DIR, format_id, name)

    # Write the YAML file with the new name
    with open(new_filename, 'w') as file:
        yaml.dump(ordered_data, file, default_flow_style=False, Dumper=yaml.SafeDumper)

    return ordered_data

def load_format(id):
    files = [f for f in os.listdir(FORMAT_DIR) if f.startswith(f"{id}_") and f.endswith('.yml')]
    if files:
        filename = os.path.join(FORMAT_DIR, files[0])
        with open(filename, 'r') as file:
            data = yaml.safe_load(file)
            return data
    return None

def load_all_formats():
    formats = []
    for filename in os.listdir(FORMAT_DIR):
        if filename.endswith('.yml'):
            with open(os.path.join(FORMAT_DIR, filename), 'r') as file:
                data = yaml.safe_load(file)
                formats.append(data)
    return formats

def delete_format(id):
    files = [f for f in os.listdir(FORMAT_DIR) if f.startswith(f"{id}_") and f.endswith('.yml')]
    if files:
        os.remove(os.path.join(FORMAT_DIR, files[0]))
        return True
    return False
