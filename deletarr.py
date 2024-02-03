import requests
import os
import yaml
import json

# ANSI escape sequences for colors
class Colors:
    HEADER = '\033[95m'  # Purple for questions and headers
    OKBLUE = '\033[94m'  # Blue for actions
    OKGREEN = '\033[92m'  # Green for success messages
    FAIL = '\033[91m'  # Red for error messages
    ENDC = '\033[0m'  # Reset to default
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
    print(Colors.HEADER + "\nAvailable instances to delete from:" + Colors.ENDC)
    sources = []

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
    choice = input(Colors.HEADER + "Enter the number of the instance to delete from: " + Colors.ENDC).strip()
    while not choice.isdigit() or int(choice) < 1 or int(choice) > len(sources):
        print_error("Invalid input. Please enter a valid number.")
        choice = input(Colors.HEADER + "Enter the number of the instance to delete from: " + Colors.ENDC).strip()

    selected_app, selected_name = sources[int(choice) - 1]
    print()
    return selected_app, selected_name

def user_select_items_to_delete(items):
    print(Colors.HEADER + "\nAvailable items:" + Colors.ENDC)
    for idx, item in enumerate(items, start=1):
        print(f"{idx}. {item['name']}")
    print(Colors.HEADER + "Type the number(s) of the items you wish to delete separated by commas, or type 'all' to delete everything." + Colors.ENDC)
    
    selection = input(Colors.HEADER + "Your choice: " + Colors.ENDC).strip().lower()
    if selection == 'all':
        return [item['id'] for item in items]  # Return all IDs if "all" is selected
    else:
        selected_ids = []
        try:
            selected_indices = [int(i) - 1 for i in selection.split(',') if i.isdigit()]
            for idx in selected_indices:
                if idx < len(items):
                    selected_ids.append(items[idx]['id'])
            return selected_ids
        except ValueError:
            print_error("Invalid input. Please enter a valid number or 'all'.")
            return []

def delete_custom_formats(source_config):
    print(Colors.OKBLUE + "\nDeleting selected custom formats..." + Colors.ENDC)
    headers = {"X-Api-Key": source_config['api_key']}
    get_url = f"{source_config['base_url']}/api/v3/customformat"

    try:
        response = requests.get(get_url, headers=headers)
        if response.status_code == 200:
            formats_to_delete = response.json()
            selected_ids = user_select_items_to_delete(formats_to_delete)

            for format_id in selected_ids:
                delete_url = f"{get_url}/{format_id}"
                del_response = requests.delete(delete_url, headers=headers)
                format_name = next((item['name'] for item in formats_to_delete if item['id'] == format_id), "Unknown")
                if del_response.status_code in [200, 202, 204]:
                    print(Colors.OKBLUE + f"Deleting custom format '{format_name}': " + Colors.ENDC + Colors.OKGREEN + "SUCCESS" + Colors.ENDC)
                else:
                    print(Colors.OKBLUE + f"Deleting custom format '{format_name}': " + Colors.ENDC + Colors.FAIL + "FAIL" + Colors.ENDC)
        else:
            print_error("Failed to retrieve custom formats for deletion!")
    except requests.exceptions.ConnectionError:
        print_connection_error()

def delete_quality_profiles(source_config):
    print(Colors.OKBLUE + "\nDeleting selected quality profiles..." + Colors.ENDC)
    headers = {"X-Api-Key": source_config['api_key']}
    get_url = f"{source_config['base_url']}/api/v3/qualityprofile"

    try:
        response = requests.get(get_url, headers=headers)
        if response.status_code == 200:
            profiles_to_delete = response.json()
            selected_ids = user_select_items_to_delete(profiles_to_delete)

            for profile_id in selected_ids:
                delete_url = f"{get_url}/{profile_id}"
                del_response = requests.delete(delete_url, headers=headers)
                profile_name = next((item['name'] for item in profiles_to_delete if item['id'] == profile_id), "Unknown")
                if del_response.status_code in [200, 202, 204]:
                    print(Colors.OKBLUE + f"Deleting quality profile '{profile_name}': " + Colors.ENDC + Colors.OKGREEN + "SUCCESS" + Colors.ENDC)
                else:
                    # Handle failure due to the profile being in use or other errors
                    error_message = "Failed to delete due to an unknown error."
                    try:
                        # Attempt to parse JSON error message from response
                        error_details = del_response.json()
                        if 'message' in error_details:
                            error_message = error_details['message']
                        elif 'error' in error_details:
                            error_message = error_details['error']
                    except json.JSONDecodeError:
                        # If response is not JSON or doesn't have expected fields
                        error_message = del_response.text or "Failed to delete with no detailed error message."
                    
                    print(Colors.OKBLUE + f"Deleting quality profile '{profile_name}': " + Colors.ENDC + Colors.FAIL + f"FAIL - {error_message}" + Colors.ENDC)
        else:
            print_error("Failed to retrieve quality profiles for deletion!")
    except requests.exceptions.ConnectionError:
        print_connection_error()

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

if __name__ == "__main__":
    selected_app, selected_instance = get_user_choice()
    source_config = get_app_config(selected_app, selected_instance)
    source_config['app_name'] = selected_app

    print(Colors.HEADER + "\nChoose what to delete:" + Colors.ENDC)
    print("1. Custom Formats")
    print("2. Quality Profiles")
    choice = input(Colors.HEADER + "Enter your choice (1/2): " + Colors.ENDC).strip()

    if choice == "1":
        delete_custom_formats(source_config)
    elif choice == "2":
        delete_quality_profiles(source_config)
