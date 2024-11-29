# app/arr/status/ping.py
import socket
import requests
import logging

logger = logging.getLogger(__name__)

REQUIRED_VERSIONS = {'radarr': '5.10.4', 'sonarr': '4.0.10'}


def check_version_compatibility(installed_version, required_version):
    """
    Check if installed version meets minimum required version for Radarr/Sonarr.
    """
    installed_parts = [int(x) for x in installed_version.split('.')]
    required_parts = [int(x) for x in required_version.split('.')]

    # Only compare the parts we care about (first 3 numbers for Radarr/Sonarr)
    for installed, required in zip(installed_parts[:3], required_parts[:3]):
        if installed < required:
            return False
        if installed > required:
            return True
    return True


def ping_service(url, api_key, arr_type):
    """
    Ping an Arr service and verify its type and version
    """
    try:
        base_url = url.rstrip('/')
        headers = {'X-Api-Key': api_key}

        logger.warning(f"Attempting to connect to {base_url} for {arr_type}")

        response = requests.get(f"{base_url}/api/v3/system/status",
                                headers=headers,
                                timeout=10)

        logger.warning(f"Response status: {response.status_code}")
        logger.warning(f"Response content: {response.text}")

        if response.status_code != 200:
            return False, f"Service returned status code: {response.status_code}"

        data = response.json()
        logger.warning(f"Parsed response data: {data}")

        # First check app type
        app_name = data.get('appName', '').lower()
        version = data.get('version')

        logger.warning(f"Found app: {app_name} version: {version}")

        # Check app type
        if arr_type == 'radarr' and app_name != 'radarr':
            return False, f"Expected Radarr but found {app_name}"
        elif arr_type == 'sonarr' and app_name != 'sonarr':
            return False, f"Expected Sonarr but found {app_name}"

        # Check version
        if not version:
            return False, "Could not determine application version"

        required_version = REQUIRED_VERSIONS.get(arr_type)
        if not check_version_compatibility(version, required_version):
            return False, f"{app_name.title()} version {version} is not supported. Minimum required version is {required_version}"

        return True, "Connection successful and application type and version verified"

    except requests.exceptions.Timeout:
        return False, "Connection timed out"
    except requests.exceptions.ConnectionError:
        return False, "Failed to connect to service"
    except Exception as e:
        logger.error(f"Error pinging service: {str(e)}")
        return False, f"Error: {str(e)}"
