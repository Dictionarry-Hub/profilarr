# app/arr/status/ping.py
import socket
import requests
import logging

logger = logging.getLogger(__name__)


def ping_service(url, api_key, arr_type):
    """
    Ping an Arr service and verify its type
    """
    try:
        # Clean up URL
        base_url = url.rstrip('/')
        headers = {'X-Api-Key': api_key}

        # First check if service is responsive
        response = requests.get(f"{base_url}/api/v3/system/status",
                                headers=headers,
                                timeout=10)

        if response.status_code != 200:
            return False, f"Service returned status code: {response.status_code}"

        data = response.json()

        # Verify the application type
        app_name = data.get('appName', '').lower()

        if arr_type == 'radarr' and app_name != 'radarr':
            return False, f"Expected Radarr but found {app_name}"
        elif arr_type == 'sonarr' and app_name != 'sonarr':
            return False, f"Expected Sonarr but found {app_name}"

        return True, "Connection successful and application type verified"

    except requests.exceptions.Timeout:
        return False, "Connection timed out"
    except requests.exceptions.ConnectionError:
        return False, "Failed to connect to service"
    except Exception as e:
        logger.error(f"Error pinging service: {str(e)}")
        return False, f"Error: {str(e)}"
