import json
import requests
import os
import re

# ANSI escape sequences for colors
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

# Load configuration for main app
with open('config.json', 'r') as config_file:
    config = json.load(config_file)['master']

def get_user_choice():
    choice = input("Enter an app to export from (radarr/sonarr): ").lower()
    while choice not in ["radarr", "sonarr"]:
        print(Colors.FAIL + "Invalid input. Please enter either 'radarr' or 'sonarr'." + Colors.ENDC)
        choice = input("Enter the source (radarr/sonarr): ").lower()
    print()
    return choice

def get_export_choice():
    print(Colors.HEADER + "Choose what to export:" + Colors.ENDC)
    print("1. Custom Formats")
    print("2. Quality Profiles")
    print("3. Both")
    choice = input("Enter your choice (1/2/3): ").strip()
    while choice not in ["1", "2", "3"]:
        print(Colors.FAIL + "Invalid input. Please enter 1, 2, or 3." + Colors.ENDC)
        choice = input("Enter your choice (1/2/3): ").strip()
    print()
    return choice

def get_app_config(source):
    app_config = config[source]
    return app_config['base_url'], app_config['api_key']

def sanitize_filename(filename):
    sanitized_filename = re.sub(r'[\\/*?:"<>|]', '_', filename)
    return sanitized_filename

def handle_response_errors(response):
    if response.status_code == 401:
        print(Colors.FAIL + "Authentication error: Invalid API key." + Colors.ENDC)
    elif response.status_code == 403:
        print(Colors.FAIL + "Forbidden: Access is denied." + Colors.ENDC)
    else:
        print(Colors.FAIL + f"An error occurred! (HTTP {response.status_code})" + Colors.ENDC)
        print("Response Content: ", response.content.decode('utf-8'))

def print_saved_items(items, item_type):
    if len(items) > 10:
        items_to_display = items[:10]
        for item in items_to_display:
            print(f" - {item}")
        print(f"... and {len(items) - 10} more.")
    else:
        for item in items:
            print(f" - {item}")

def ensure_directory_exists(directory):
    if not os.path.exists(directory):
        os.makedirs(directory)
        print(Colors.OKBLUE + f"Created directory: {directory}" + Colors.ENDC)

def export_cf(source, save_path='./custom_formats'):
    ensure_directory_exists(save_path)  # Ensure the directory exists with the given save_path

    base_url, api_key = get_app_config(source)
    headers = {"X-Api-Key": api_key}
    params = {"apikey": api_key}

    print(Colors.OKBLUE + f"Attempting to access {source.capitalize()} at {base_url}" + Colors.ENDC)

    custom_format_url = f"{base_url}/api/v3/customformat"

    try:
        response = requests.get(custom_format_url, params=params, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print(Colors.OKGREEN + f"Found {len(data)} custom formats." + Colors.ENDC)

            saved_formats = []
            for custom_format in data:
                custom_format.pop('id', None)
                saved_formats.append(custom_format['name'])
            
            file_path = f'{save_path}/Custom Formats ({source.capitalize()}).json'
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=4)

            print_saved_items(saved_formats, "Custom Formats")
            print(Colors.OKGREEN + f"Saved to '{file_path}'" + Colors.ENDC)
            print()
        else:
            handle_response_errors(response)

    except requests.exceptions.ConnectionError:
        print(Colors.FAIL + f"Failed to connect to {source.capitalize()}! Please check if it's running and accessible." + Colors.ENDC)



def export_qf(source, save_path='./profiles'):
    ensure_directory_exists(save_path)  # Ensure the directory exists with the given save_path

    base_url, api_key = get_app_config(source)
    headers = {"X-Api-Key": api_key}
    params = {"apikey": api_key}

    print(Colors.OKBLUE + f"Attempting to access {source.capitalize()} at {base_url}" + Colors.ENDC)
    
    try:
        response = requests.get(f"{base_url}/api/v3/qualityprofile", params=params, headers=headers)

        if response.status_code == 200:
            quality_profiles = response.json()
            print(Colors.OKGREEN + f"Found {len(quality_profiles)} quality profiles." + Colors.ENDC)

            if not os.path.exists('./profiles'):
                os.makedirs('./profiles')

            saved_profiles = []
            for profile in quality_profiles:
                profile.pop('id', None)
                profile_name = profile.get('name', 'unnamed_profile')
                profile_name = sanitize_filename(profile_name)
                profile_filename = f"{profile_name} ({source.capitalize()}).json"
                profile_filepath = os.path.join(save_path, profile_filename)
                saved_profiles.append(profile_name)

                with open(profile_filepath, 'w') as file:
                    json.dump([profile], file, indent=4)
            print_saved_items(saved_profiles, "Quality Profiles")
            print(Colors.OKGREEN + f"Saved to '{profile_filepath}'" + Colors.ENDC)
            print()
        else:
            handle_response_errors(response)

    except requests.exceptions.ConnectionError:
        print(Colors.FAIL + f"Failed to connect to {source.capitalize()}! Please check if it's running and accessible." + Colors.ENDC)


if __name__ == "__main__":
    user_choice = get_user_choice()
    export_choice = get_export_choice()

    if export_choice in ["1", "3"]:
        export_cf(user_choice)
    if export_choice in ["2", "3"]:
        export_qf(user_choice)
