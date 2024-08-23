import os
import yaml

DATA_DIR = '/app/data'
FORMAT_DIR = os.path.join(DATA_DIR, 'db', 'custom_formats')
PROFILE_DIR = os.path.join(DATA_DIR, 'db', 'profiles')

def load_all_formats():
    formats = []
    for filename in os.listdir(FORMAT_DIR):
        if filename.endswith('.yml'):
            with open(os.path.join(FORMAT_DIR, filename), 'r') as file:
                data = yaml.safe_load(file)
                formats.append(data)
    return formats

def load_all_profiles():
    profiles = []
    for filename in os.listdir(PROFILE_DIR):
        if filename.endswith('.yml'):
            with open(os.path.join(PROFILE_DIR, filename), 'r') as file:
                data = yaml.safe_load(file)
                profiles.append(data)
    return profiles