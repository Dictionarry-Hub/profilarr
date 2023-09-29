import json
import requests
import os  # For deleting the temporary file

# Define constants
base_url = "http://localhost:7878"  # Update to your Radarr URL
api_key = "API_GOES_HERE"  # Update to your Radarr API Key

# Define headers
params = {"apikey": api_key}
headers = {"X-Api-Key": api_key}

def cf_import_sync():
    custom_format_url = f"{base_url}/api/v3/customformat"
    response = requests.get(custom_format_url, headers=headers)

    if response.status_code == 200:
        data = response.json()
        with open('custom_formats.json', 'w') as file:
            json.dump(data, file, indent=4)
        print("Custom Formats have been saved to 'custom_formats.json'")
        return True
    else:
        print(f"Failed to retrieve custom formats! (HTTP {response.status_code})")
        print("Response Content: ", response.content.decode('utf-8'))
        return False


def import_qf():
    # Call cf_import_sync first
    cf_import_sync()

    profile_dir = './profiles'
    profiles = [f for f in os.listdir(profile_dir) if f.endswith('.json')]

    # Prompt user to select a profile
    print("Available Profiles:")
    for i, profile in enumerate(profiles, 1):
        print(f"{i}. {profile}")

    selection = input("Please enter the number of the profile you want to import: ")

    try:
        selected_file = profiles[int(selection) - 1]
    except (ValueError, IndexError):
        print("Invalid selection, please enter a valid number.")
        return

    # Load the selected profile
    with open(os.path.join(profile_dir, selected_file), 'r') as file:
        try:
            quality_profiles = json.load(file)
        except json.JSONDecodeError as e:
            print(f"Error loading selected profile: {e}")
            return

    # Load custom formats
    try:
        with open('custom_formats.json', 'r') as file:
            custom_formats_data = json.load(file)
            custom_formats = {format['name']: format['id'] for format in custom_formats_data}
    except Exception as e:
        print(f"Failed to load custom formats! Error: {e}")
        return

    # Process each profile and send requests
    for profile in quality_profiles:
        existing_format_names = set()
        if 'formatItems' in profile:
            for format_item in profile['formatItems']:
                format_name = format_item.get('name')
                if format_name:
                    existing_format_names.add(format_name)
                    if format_name in custom_formats:
                        format_item['format'] = custom_formats[format_name]

        for format_name, format_id in custom_formats.items():
            if format_name not in existing_format_names:
                profile.setdefault('formatItems', []).append({
                    "format": format_id,
                    "name": format_name,
                    "score": 0
                })

        post_url = f"{base_url}/api/v3/qualityprofile"
        response = requests.post(post_url, json=profile, params=params, headers=headers)
        
        if response.status_code in [200, 201]:
            print(f"Successfully added Quality Profile {profile['name']}! (HTTP {response.status_code})")
        else:
            try:
                # Assuming the response is JSON, parse it
                errors = response.json()
                
                # Extract relevant information from the error message
                message = errors.get("message", "No Message Provided")
                description = errors.get("description", "No Description Provided")
                
                # Format and print the error message
                print(f"Failed to add Quality Profile {profile['name']}! (HTTP {response.status_code})")
                print(f"Error Message: {message}")

            except json.JSONDecodeError:
                # If response is not JSON, print the whole response
                print("Failed to parse error message:")
                print(response.text)
    try:
        os.remove('custom_formats.json')
    except FileNotFoundError:
        pass  # File already deleted or does not exist



if __name__ == "__main__":
    import_qf()
