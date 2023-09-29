import json
import requests
import os
import re

# Define constants
base_url = "http://localhost:7878"
api_key = "API_GOES_HERE"

# Define parameters and headers
params = {"apikey": api_key}
headers = {"X-Api-Key": api_key}
files = {'file': ('', '')}  # Empty file to force multipart/form-data

# Login
login_url = f"{base_url}/login"
response = requests.get(login_url, params=params, headers=headers, files=files)

if response.status_code != 200:
    print(f"Login Failed! (HTTP {response.status_code})")
    print("Response Content: ", response.content)
    exit()

def export_cf():
    custom_format_url = f"{base_url}/api/v3/customformat"
    response = requests.get(custom_format_url, params=params, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        
        # Remove 'id' from each custom format
        for custom_format in data:
            custom_format.pop('id', None)

        # Ensure the ./custom_formats directory exists
        if not os.path.exists('./custom_formats'):
            os.makedirs('./custom_formats')
        
        # Save to JSON file
        with open('./custom_formats/cf.json', 'w') as f:
            json.dump(data, f, indent=4)
        print("Custom Formats have been saved to './custom_formats/cf.json'")
    else:
        print(f"Failed to retrieve custom formats! (HTTP {response.status_code})")
        print("Response Content: ", response.content)

def sanitize_filename(filename):
    # Replace any characters not allowed in filenames with _
    sanitized_filename = re.sub(r'[\\/*?:"<>|]', '_', filename)
    return sanitized_filename

def export_qf():
    response = requests.get(f"{base_url}/api/v3/qualityprofile", params=params, headers=headers)

    if response.status_code == 200:
        quality_profiles = response.json()

        # Ensure the ./profiles directory exists
        if not os.path.exists('./profiles'):
            os.makedirs('./profiles')

        # Process each profile separately
        for profile in quality_profiles:
            profile.pop('id', None)  # Remove the 'id' field

            # Use the name of the profile to create a filename
            profile_name = profile.get('name', 'unnamed_profile')  # Use a default name if the profile has no name
            profile_name = sanitize_filename(profile_name)  # Sanitize the filename
            profile_filename = f"{profile_name}.json"
            profile_filepath = os.path.join('./profiles', profile_filename)

            # Save the individual profile to a file as a single-element array
            with open(profile_filepath, 'w') as file:
                json.dump([profile], file, indent=4)  # Note the [profile], it will make it an array with a single element

        print("Quality profiles have been successfully saved to the ./profiles directory")
    else:
        print("Failed to retrieve quality profiles!")
        print("Response Content: ", response.content.decode('utf-8'))



if __name__ == "__main__":
    export_cf()
    export_qf()