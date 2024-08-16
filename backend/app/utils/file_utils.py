import os
import datetime

def get_next_id(directory):
    files = [f for f in os.listdir(directory) if f.endswith('.yml')]
    if not files:
        return 1
    return max(int(f.split('_')[0]) for f in files) + 1

def generate_filename(directory, id, name):
    sanitized_name = name.replace(' ', '_').lower()
    return os.path.join(directory, f"{id}_{sanitized_name}.yml")

def get_current_timestamp():
    return datetime.datetime.now().isoformat()