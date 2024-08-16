import os
import yaml
from collections import OrderedDict
from .file_utils import get_next_id, generate_filename, get_current_timestamp, sanitize_input

REGEX_DIR = 'regex_patterns'

def save_regex(data):
    ordered_data = OrderedDict()
    if 'id' in data and data['id'] != 0:
        ordered_data['id'] = data['id']
    else:
        ordered_data['id'] = get_next_id(REGEX_DIR)
   
    ordered_data['name'] = sanitize_input(data.get('name', ''))
    ordered_data['description'] = sanitize_input(data.get('description', ''))
    ordered_data['pattern'] = sanitize_input(data.get('pattern', ''))
    ordered_data['regex101Link'] = sanitize_input(data.get('regex101Link', ''))
    ordered_data['regex101DeleteCode'] = sanitize_input(data.get('regex101DeleteCode', ''))  # Add this line to save the delete code
   
    if ordered_data['id'] != 0:  # Existing regex
        existing_data = load_regex(ordered_data['id'])
        if existing_data:
            ordered_data['date_created'] = existing_data.get('date_created', get_current_timestamp())
        else:
            ordered_data['date_created'] = get_current_timestamp()
    else:  # New regex
        ordered_data['date_created'] = get_current_timestamp()
   
    ordered_data['date_modified'] = get_current_timestamp()
    ordered_data['tags'] = [sanitize_input(tag) for tag in data.get('tags', [])]
   
    filename = generate_filename(REGEX_DIR, ordered_data['id'], ordered_data['name'])
    with open(filename, 'w') as file:
        for key, value in ordered_data.items():
            if key in ['description', 'date_created', 'date_modified', 'regex101Link', 'regex101DeleteCode']:  # Add 'regex101DeleteCode' to this list
                file.write(f"{key}: '{value}'\n")
            elif key == 'tags':
                file.write('tags:\n')
                for tag in value:
                    file.write(f'- {tag}\n')
            else:
                file.write(f'{key}: {value}\n')
   
    return ordered_data


def load_regex(id):
    files = [f for f in os.listdir(REGEX_DIR) if f.startswith(f"{id}_") and f.endswith('.yml')]
    if files:
        filename = os.path.join(REGEX_DIR, files[0])
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
    files = [f for f in os.listdir(REGEX_DIR) if f.startswith(f"{id}_") and f.endswith('.yml')]
    if files:
        os.remove(os.path.join(REGEX_DIR, files[0]))
        return True
    return False