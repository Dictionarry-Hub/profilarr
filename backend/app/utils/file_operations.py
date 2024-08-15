import os
import yaml
import datetime

REGEX_DIR = 'regex_patterns'
FORMAT_DIR = 'custom_formats'

os.makedirs(REGEX_DIR, exist_ok=True)
os.makedirs(FORMAT_DIR, exist_ok=True)

def get_next_id(directory):
    files = [f for f in os.listdir(directory) if f.endswith('.yml')]
    if not files:
        return 1
    return max(int(f.split('_')[0]) for f in files) + 1

def generate_filename(directory, id, name):
    sanitized_name = name.replace(' ', '_').lower()
    return f"{directory}/{id}_{sanitized_name}.yml"

def get_current_timestamp():
    return datetime.datetime.now().isoformat()

def save_to_file(directory, data):
    if 'id' in data and data['id'] != 0:
        # Handle updating existing records
        existing_files = [f for f in os.listdir(directory) if f.startswith(f"{data['id']}_") and f.endswith('.yml')]
        if existing_files:
            existing_filename = os.path.join(directory, existing_files[0])
            existing_data = load_from_file(directory, data['id'])
            if existing_data:
                data['date_created'] = existing_data.get('date_created', get_current_timestamp())
            else:
                data['date_created'] = get_current_timestamp()
            data['date_modified'] = get_current_timestamp()
            new_filename = generate_filename(directory, data['id'], data['name'])
           
            # Remove the old file if the name has changed
            if existing_filename != new_filename:
                os.remove(existing_filename)
           
            with open(new_filename, 'w') as file:
                yaml.dump(data, file)
            return data
        else:
            # If existing file not found, treat it as new
            data['id'] = get_next_id(directory)
            data['date_created'] = get_current_timestamp()
            data['date_modified'] = get_current_timestamp()
    else:
        # Handle new records
        data['id'] = get_next_id(directory)
        data['date_created'] = get_current_timestamp()
        data['date_modified'] = get_current_timestamp()
   
    new_filename = generate_filename(directory, data['id'], data['name'])
    with open(new_filename, 'w') as file:
        yaml.dump(data, file)
   
    return data

def load_from_file(directory, id):
    files = [f for f in os.listdir(directory) if f.startswith(f"{id}_") and f.endswith('.yml')]
    if files:
        filename = os.path.join(directory, files[0])
        with open(filename, 'r') as file:
            data = yaml.safe_load(file)
            if 'conditions' not in data:
                data['conditions'] = []  # Ensure conditions is always a list
            if 'regex101Link' not in data:
                data['regex101Link'] = ''  # Ensure regex101Link is always present
            return data
    return None

def load_all_from_directory(directory):
    items = []
    for filename in os.listdir(directory):
        if filename.endswith('.yml'):
            with open(os.path.join(directory, filename), 'r') as file:
                data = yaml.safe_load(file)
                if 'regex101Link' not in data:
                    data['regex101Link'] = ''  # Ensure regex101Link is always present
                items.append(data)
    return items

def delete_file(directory, id):
    files = [f for f in os.listdir(directory) if f.startswith(f"{id}_") and f.endswith('.yml')]
    if files:
        os.remove(os.path.join(directory, files[0]))
        return True
    return False
