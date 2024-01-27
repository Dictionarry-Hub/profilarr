import requests
import os
import re
import yaml
import json

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
with open('config.yml', 'r') as config_file:
    config = yaml.safe_load(config_file)
    master_config = config['instances']['master']

def print_success(message):
    print(Colors.OKGREEN + message + Colors.ENDC)

def print_error(message):
    print(Colors.FAIL + message + Colors.ENDC)

def print_connection_error():
    print(Colors.FAIL + "Failed to connect to the service! Please check if it's running and accessible." + Colors.ENDC)

def get_user_choice():
    sources = []
    print(Colors.HEADER + "Available instances to import to:" + Colors.ENDC)

    # Add master installations
    for app in master_config:
        sources.append((app, f"{app.capitalize()} [Master]"))

    # Add extra installations
    if "extras" in config['instances']:
        for app, instances in config['instances']['extras'].items():
            for install in instances:
                sources.append((app, f"{app.capitalize()} [{install['name']}]"))

    # Display sources with numbers
    for idx, (app, name) in enumerate(sources, start=1):
        print(f"{idx}. {name}")

    # User selection
    choice = input("Enter the number of the instance to import to: ").strip()
    while not choice.isdigit() or int(choice) < 1 or int(choice) > len(sources):
        print_error("Invalid input. Please enter a valid number.")
        choice = input("Enter the number of the instance to import to: ").strip()

    selected_app, selected_name = sources[int(choice) - 1]
    print()
    return selected_app, selected_name

def get_import_choice():
    print()
    print(Colors.HEADER + "Choose what to import:" + Colors.ENDC)
    print("1. Custom Formats")
    print("2. Quality Profiles")
    choice = input("Enter your choice (1/2): ").strip()
    while choice not in ["1", "2"]:
        print_error("Invalid input. Please enter 1 or 2.")
        choice = input("Enter your choice (1/2): ").strip()
    return choice

def get_app_config(app_name, instance_name):
    if instance_name.endswith("[Master]"):
        return master_config[app_name]
    else:
        instance_name = instance_name.replace(f"{app_name.capitalize()} [", "").replace("]", "")
        extras = config['instances']['extras'].get(app_name, [])
        for instance in extras:
            if instance['name'] == instance_name:
                return instance
    raise ValueError(f"Configuration for {app_name} - {instance_name} not found.")

def select_file(directory, app_name, sync_mode=False):
    app_name = app_name.lower()
    files = [f for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f)) and app_name in f.lower()]
    if not files:
        print_error(f"No files found for {app_name.capitalize()} in {directory}.")
        return None

    if sync_mode:
        # Automatically select all files in sync mode
        return files

    print()
    print(Colors.OKBLUE + "Available files:" + Colors.ENDC)
    for i, file in enumerate(files, 1):
        print(f"{i}. {file}")

    choice = input("Select a file to import (or 'all' for all files): ").strip()
    print()
    if choice.isdigit() and 1 <= int(choice) <= len(files):
        return [files[int(choice) - 1]]
    elif choice.lower() == 'all':
        return files
    else:
        print_error("Invalid input. Please enter a valid number or 'all'.")
        print()
        return None



def import_custom_formats(source_config, import_path='./custom_formats', selected_files=None, sync_mode=False):
    headers = {"X-Api-Key": source_config['api_key']}
    get_url = f"{source_config['base_url']}/api/v3/customformat"

    try:
        response = requests.get(get_url, headers=headers)
        if response.status_code == 200:
            existing_formats = response.json()
            existing_names_to_id = {format['name']: format['id'] for format in existing_formats}

            if selected_files is None:
                selected_files = select_file(import_path, source_config['app_name'], sync_mode=sync_mode)
                if not selected_files:
                    return  # Exit if no file is selected

            for selected_file in selected_files:
                added_count, updated_count = 0, 0
                with open(os.path.join(import_path, selected_file), 'r') as import_file:
                    import_formats = json.load(import_file)

                for format in import_formats:
                    format_name = format['name']
                    if format_name in existing_names_to_id:
                        format_id = existing_names_to_id[format_name]
                        put_url = f"{source_config['base_url']}/api/v3/customformat/{format_id}"
                        response = requests.put(put_url, json=format, headers=headers)
                        if response.status_code in [200, 201, 202]:
                            print(Colors.WARNING + f"Updating custom format '{format_name}': " + Colors.ENDC, end='')
                            print_success("SUCCESS")
                            updated_count += 1
                        else:
                            print_error(f"Updating custom format '{format_name}': FAIL")
                            print(response.content.decode())

                    else:
                        post_url = f"{source_config['base_url']}/api/v3/customformat"
                        response = requests.post(post_url, json=format, headers=headers)
                        if response.status_code in [200, 201]:
                            print(Colors.OKBLUE + f"Adding custom format '{format_name}': " + Colors.ENDC, end='')
                            print_success("SUCCESS")
                            added_count += 1
                        else:
                            print_error(f"Adding custom format '{format_name}': FAIL")
                            print(response.content.decode())

                print()
                print_success(f"Successfully added {added_count} custom formats, updated {updated_count} custom formats.")

        else:
            print_error(f"Failed to retrieve existing custom formats from {get_url}! (HTTP {response.status_code})")
            print(response.content.decode())

    except requests.exceptions.ConnectionError:
        print_connection_error()



def import_quality_profiles(source_config, import_path='./profiles', selected_files=None, sync_mode=False):
    headers = {"X-Api-Key": source_config['api_key']}

    try:
        cf_import_sync(source_config)

        if not selected_files:
            if sync_mode:
                # Automatically select all profile files
                selected_files = [f for f in os.listdir(import_path) if os.path.isfile(os.path.join(import_path, f))]

            if not selected_files:
                return  # Exit if no file is selected

        for selected_file in selected_files:
            with open(os.path.join(import_path, selected_file), 'r') as file:
                try:
                    quality_profiles = json.load(file)
                except json.JSONDecodeError as e:
                    print_error(f"Error loading selected profile: {e}")
                    continue

                for profile in quality_profiles:
                    existing_format_names = set()
                    if 'formatItems' in profile:
                        for format_item in profile['formatItems']:
                            format_name = format_item.get('name')
                            if format_name:
                                existing_format_names.add(format_name)
                                if format_name in source_config['custom_formats']:
                                    format_item['format'] = source_config['custom_formats'][format_name]

                    for format_name, format_id in source_config['custom_formats'].items():
                        if format_name not in existing_format_names:
                            profile.setdefault('formatItems', []).append({
                                "format": format_id,
                                "name": format_name,
                                "score": 0
                            })

                    post_url = f"{source_config['base_url']}/api/v3/qualityprofile"
                    response = requests.post(post_url, json=profile, headers=headers)

                    if response.status_code in [200, 201]:
                        print_success(f"Successfully added Quality Profile {profile['name']}")
                    elif response.status_code == 409:
                        print_error(f"Failed to add Quality Profile {profile['name']} due to a naming conflict. Quality profile names must be unique. (HTTP {response.status_code})")
                    else:
                        try:
                            errors = response.json()
                            message = errors.get("message", "No Message Provided")
                            print_error(f"Failed to add Quality Profile {profile['name']}! (HTTP {response.status_code})")
                            print(message)
                        except json.JSONDecodeError:
                            print_error("Failed to parse error message:")
                            print(response.text)

    except requests.exceptions.ConnectionError:
        print_connection_error()




def cf_import_sync(source_config):
    headers = {"X-Api-Key": source_config['api_key']}
    custom_format_url = f"{source_config['base_url']}/api/v3/customformat"
    try:
        response = requests.get(custom_format_url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            source_config['custom_formats'] = {format['name']: format['id'] for format in data}
        elif response.status_code == 401:
            print_error("Authentication error: Invalid API key. Terminating program.")
            exit(1)
        else:
            print_error(f"Failed to retrieve custom formats! (HTTP {response.status_code})")
            print(response.content.decode())
            exit(1)

    except requests.exceptions.ConnectionError:
        print_connection_error()
        exit(1)


if __name__ == "__main__":
    selected_app, selected_instance = get_user_choice()
    source_config = get_app_config(selected_app, selected_instance)
    source_config['app_name'] = selected_app
    import_choice = get_import_choice()

    if import_choice == "1":
        selected_files = select_file('./custom_formats', selected_app)
        if selected_files:
            import_custom_formats(source_config, './custom_formats', selected_files)
    elif import_choice == "2":
        selected_files = select_file('./profiles', selected_app)
        if selected_files:
            import_quality_profiles(source_config, './profiles', selected_files)