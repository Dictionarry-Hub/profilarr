import os
import yaml

DATA_DIR = '/app/data'
SETTINGS_FILE = os.path.join(DATA_DIR, 'config', 'settings.yml')

def load_settings():
    try:
        if not os.path.exists(SETTINGS_FILE):
            return None  # Indicate that the settings file does not exist

        with open(SETTINGS_FILE, 'r') as file:
            settings = yaml.safe_load(file)
            return settings if settings else None
    except Exception as e:
        return None

def save_settings(settings):
    try:
        os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
        with open(SETTINGS_FILE, 'w') as file:
            yaml.dump(settings, file)
    except Exception as e:
        pass

def create_empty_settings_if_not_exists():
    if not os.path.exists(SETTINGS_FILE):
        save_settings({})
    