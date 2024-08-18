import os
import git
import datetime
import re
import yaml
from yaml import safe_load
from collections import OrderedDict

def get_next_id(directory):
    max_id = 0
    for filename in os.listdir(directory):
        if filename.endswith('.yml'):
            file_path = os.path.join(directory, filename)
            with open(file_path, 'r') as file:
                content = yaml.safe_load(file)
                file_id = content.get('id', 0)
                if isinstance(file_id, int) and file_id > max_id:
                    max_id = file_id
    return max_id + 1

def generate_filename(directory, id, name):
    sanitized_name = name.replace(' ', '_').lower()
    return os.path.join(directory, f"{id}_{sanitized_name}.yml")

def get_current_timestamp():
    return datetime.datetime.now().isoformat()

def sanitize_input(input_str):
    if not isinstance(input_str, str):
        return input_str

    # Remove any leading/trailing whitespace
    sanitized_str = input_str.strip()

    # Replace tabs with spaces
    sanitized_str = sanitized_str.replace('\t', ' ')

    # Collapse multiple spaces into a single space
    sanitized_str = re.sub(r'\s+', ' ', sanitized_str)

    # Escape special characters for YAML
    special_chars = r'[:#&*?|<>%@`]'
    sanitized_str = re.sub(special_chars, lambda m: '\\' + m.group(0), sanitized_str)

    # If the string starts with any of these characters, quote the entire string
    if re.match(r'^[\'"-]', sanitized_str):
        sanitized_str = yaml.dump(sanitized_str, default_style='"').strip()

    # Handle multi-line strings
    if '\n' in sanitized_str:
        sanitized_str = '|\n' + '\n'.join(f'  {line}' for line in sanitized_str.split('\n'))

    return sanitized_str

def represent_ordereddict(dumper, data):
    return dumper.represent_mapping('tag:yaml.org,2002:map', data.items())

yaml.add_representer(OrderedDict, represent_ordereddict, Dumper=yaml.SafeDumper)

