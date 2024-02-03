import yaml
import json

class Colors:
    QUESTION = '\033[94m'
    INFO = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    OK = '\033[92m'
    ENDC = '\033[0m'

class Apps:
    APP_CHOICES = {
        "1": "Radarr",
        "2": "Sonarr",
        # Add more apps here as needed
    }

def print_message(message, message_type):
    color = Colors.ENDC  # default color

    if message_type == 'success':
        color = Colors.OK
    elif message_type == 'error':
        color = Colors.FAIL
    elif message_type == 'warning':
        color = Colors.WARNING
    elif message_type == 'info':
        color = Colors.INFO
    elif message_type == 'question':
        color = Colors.QUESTION

    print(color + message + Colors.ENDC)

def load_config():
    with open('config.yml', 'r') as config_file:
        config = yaml.safe_load(config_file)
    return config

def get_app_choice():
    print_message("Select your app of choice", "question")
    # Dynamically generate the app selection menu
    app_menu = "\n".join([f"{key}. {value}" for key, value in Apps.APP_CHOICES.items()])
    print_message(app_menu, "info")
    print_message("Enter your choice: ", "question")
    app_choice = input().strip()
    print()

    while app_choice not in Apps.APP_CHOICES.keys():
        print_message("Invalid input. Please enter a valid choice.", "warning")
        app_choice = input().strip()

    app = Apps.APP_CHOICES[app_choice]

    return app

def get_instance_choice(app):
    config = load_config() 
    app_instances = config['instances'].get(app.lower(), [])

    print_message(f"Select your {app.capitalize()} instance", "question")
    # Display instances and prompt for choice
    for i, instance in enumerate(app_instances, start=1):
        print_message(f"{i}. {app.capitalize()} ({instance['name']})", "info")

    print_message("Choose an instance by number or type 'all' for all instances: ", "question")
    choice = input().strip()
    print()
    selected_instances = []

    if choice.lower() == 'all':
        selected_instances = app_instances
    else:
        while not choice.isdigit() or int(choice) < 1 or int(choice) > len(app_instances):
            print_message("Invalid input. Please select a valid number.", "warning")
            choice = input().strip()
        selected_instance = app_instances[int(choice) - 1]
        selected_instances = [selected_instance]

    return selected_instances

# Example usage
app_choice = get_app_choice()  # This function needs to ask for 'sonarr' or 'radarr'
selected_instances = get_instance_choice(app_choice)
print(selected_instances)