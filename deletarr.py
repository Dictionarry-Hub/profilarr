import requests
import os
import yaml

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
    print(Colors.HEADER + "Available instances to delete from:" + Colors.ENDC)

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
    choice = input("Enter the number of the instance to delete from: ").strip()
    while not choice.isdigit() or int(choice) < 1 or int(choice) > len(sources):
        print_error("Invalid input. Please enter a valid number.")
        choice = input("Enter the number of the instance to delete from: ").strip()

    selected_app, selected_name = sources[int(choice) - 1]
    print()
    return selected_app, selected_name

def delete_custom_formats(source_config):
    headers = {"X-Api-Key": source_config['api_key']}
    get_url = f"{source_config['base_url']}/api/v3/customformat"

    try:
        response = requests.get(get_url, headers=headers)
        if response.status_code == 200:
            formats_to_delete = response.json()

            for format in formats_to_delete:
                print(Colors.OKBLUE + f"Deleting custom format '{format['name']}': " + Colors.ENDC, end='')
                delete_url = f"{get_url}/{format['id']}"
                del_response = requests.delete(delete_url, headers=headers)
                if del_response.status_code in [200, 202, 204]:
                    print_success("SUCCESS")
                else:
                    print_error("FAIL")
        else:
            print_error(f"Failed to retrieve custom formats for deletion! (HTTP {response.status_code})")
    except requests.exceptions.ConnectionError:
        print_connection_error()

def delete_quality_profiles(source_config):
    headers = {"X-Api-Key": source_config['api_key']}
    get_url = f"{source_config['base_url']}/api/v3/qualityprofile"

    try:
        response = requests.get(get_url, headers=headers)
        if response.status_code == 200:
            profiles_to_delete = response.json()

            for profile in profiles_to_delete:
                delete_url = f"{get_url}/{profile['id']}"
                del_response = requests.delete(delete_url, headers=headers)
                if del_response.status_code in [200, 202, 204]:
                    print(Colors.OKBLUE + f"Deleting quality profile '{profile['name']}':" + Colors.ENDC + Colors.OKGREEN + "SUCCESS" + Colors.ENDC)
                else:
                    print(Colors.OKBLUE + f"Deleting quality profile '{profile['name']}':" + Colors.ENDC + Colors.FAIL + "FAIL" + Colors.ENDC)
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

    print("Choose what to delete:")
    print("1. Custom Formats")
    print("2. Quality Profiles")
    choice = input("Enter your choice (1/2): ").strip()

    if choice == "1":
        delete_custom_formats(source_config)
    elif choice == "2":
        delete_quality_profiles(source_config)
