import json
import requests
import os

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
    config = json.load(config_file)

def print_success(message):
    print(Colors.OKGREEN + message + Colors.ENDC)

def print_error(message):
    print(Colors.FAIL + message + Colors.ENDC)

def print_connection_error():
    print(Colors.FAIL + "Failed to connect to the service! Please check if it's running and accessible." + Colors.ENDC)

def get_user_choice():
    choice = input("Enter the app you want to import to (radarr/sonarr): ").lower()
    while choice not in ["radarr", "sonarr"]:
        print_error("Invalid input. Please enter either 'radarr' or 'sonarr'.")
        choice = input("Enter the source (radarr/sonarr): ").lower()
    return choice

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

def get_app_config(source):
    return config['master'][source]

def select_file(directory):
    files = [f for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f))]
    print()
    print(Colors.OKBLUE + "Available files:" + Colors.ENDC)
    for i, file in enumerate(files, 1):
        print(f"{i}. {file}")
    choice = int(input("Select a file to import: "))
    return files[choice - 1]

def import_custom_formats(source_config, import_path='./custom_formats', auto_select_file=False):
    headers = {"X-Api-Key": source_config['api_key']}
    get_url = f"{source_config['base_url']}/api/v3/customformat"
    try:
        response = requests.get(get_url, headers=headers)
        if response.status_code == 200:
            existing_formats = response.json()
            existing_names_to_id = {format['name']: format['id'] for format in existing_formats}

            files = os.listdir(import_path)
            if auto_select_file and len(files) == 1:
                selected_file = files[0]
            else:
                selected_file = select_file(import_path)

            added_count, updated_count = 0, 0

            with open(os.path.join(import_path, selected_file), 'r') as import_file:
                import_formats = json.load(import_file)

            print()

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

def import_quality_profiles(source_config, import_path='./profiles'):
    headers = {"X-Api-Key": source_config['api_key']}
    try:
        cf_import_sync(source_config)

        profile_dir = import_path
        profiles = [f for f in os.listdir(profile_dir) if f.endswith('.json')]

        print()
        print(Colors.HEADER + "Available Profiles:" + Colors.ENDC)
        for i, profile in enumerate(profiles, 1):
            print(f"{i}. {profile}")
        print(f"{len(profiles) + 1}. Import all profiles")

        print()
        selection = input("Please enter the number of the profile you want to import (or enter " + str(len(profiles) + 1) + " to import all): ")
        selected_files = []
        try:
            selection = int(selection)
            if selection == len(profiles) + 1:
                selected_files = profiles
            else:
                selected_files = [profiles[selection - 1]]
        except (ValueError, IndexError):
            print_error("Invalid selection, please enter a valid number.")
            return

        for selected_file in selected_files:
            with open(os.path.join(profile_dir, selected_file), 'r') as file:
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
    user_choice = get_user_choice()
    source_config = get_app_config(user_choice)
    import_choice = get_import_choice()

    if import_choice == "1":
        import_custom_formats(source_config)
    elif import_choice == "2":
        import_quality_profiles(source_config)
