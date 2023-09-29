import json
import requests

# Define constants
base_url = "http://localhost:7878"  # Update to your Radarr URL
api_key = "API_GOES_HERE"  # Update to your Radarr API Key

# Define headers
headers = {"X-Api-Key": api_key}

def get_existing_formats():
    get_url = f"{base_url}/api/v3/customformat"
    print(f"Getting existing formats from {get_url}")
    response = requests.get(get_url, headers=headers)

    if response.status_code == 200:
        with open('temp_cf.json', 'w') as temp_file:
            json.dump(response.json(), temp_file)
    else:
        print(f"Failed to retrieve existing custom formats from {get_url}! (HTTP {response.status_code})")
        print("Response Content: \n", response.content.decode())
        exit(1)

def import_custom_formats():
    with open('temp_cf.json', 'r') as temp_file:
        existing_formats = json.load(temp_file)
        existing_names_to_id = {format['name']: format['id'] for format in existing_formats}

    with open('custom_formats/cf.json', 'r') as import_file:
        import_formats = json.load(import_file)

    for format in import_formats:
        format_name = format['name']
        if format_name in existing_names_to_id:
            format_id = existing_names_to_id[format_name]
            put_url = f"{base_url}/api/v3/customformat/{format_id}"
            print(f"Updating existing format {format_name} using PUT at {put_url}")
            format['id'] = format_id  # Include the id in the request body
            response = requests.put(put_url, json=format, headers=headers)

            if response.status_code in [200, 201, 202]:
                print(f"Successfully updated custom format {format_name}! (HTTP {response.status_code})")
            else:
                print(f"Failed to update custom format {format_name} at {put_url}! (HTTP {response.status_code})")
                print("Response Content: \n", response.content.decode())

        else:
            post_url = f"{base_url}/api/v3/customformat"
            print(f"Creating new format {format_name} using POST at {post_url}")
            response = requests.post(post_url, json=format, headers=headers)

            if response.status_code in [200, 201]:
                print(f"Successfully created custom format {format_name}! (HTTP {response.status_code})")
            else:
                print(f"Failed to create custom format {format_name} at {post_url}! (HTTP {response.status_code})")
                print("Response Content: \n", response.content.decode())

if __name__ == "__main__":
    get_existing_formats()
    import_custom_formats()