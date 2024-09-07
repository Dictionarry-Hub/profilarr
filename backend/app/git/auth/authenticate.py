# git/authenticate.py

import subprocess
import logging
import os
from ...settings_utils import load_settings

logger = logging.getLogger(__name__)


def get_github_token():
    token = os.environ.get('GITHUB_TOKEN')
    if token:
        logger.info("GitHub token retrieved from environment variable")
    else:
        logger.warning("GitHub token not found in environment variables")
    return token


def validate_git_token(repo_url, git_token):
    logger.info(f"Validating git token for repo: {repo_url}")
    try:
        parts = repo_url.strip('/').split('/')
        if len(parts) < 2:
            logger.error(f"Invalid repo URL format: {repo_url}")
            return False
        repo_owner, repo_name = parts[-2], parts[-1].replace('.git', '')
        logger.info(f"Parsed repo owner: {repo_owner}, repo name: {repo_name}")

        api_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}"
        logger.debug(f"GitHub API URL: {api_url}")

        curl_command = [
            'curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '-H',
            f'Authorization: Bearer {git_token}', '-H',
            'Accept: application/vnd.github+json', api_url
        ]
        logger.debug(f"Executing curl command: {' '.join(curl_command)}")
        result = subprocess.run(curl_command, capture_output=True, text=True)
        http_status_code = int(result.stdout.strip())
        logger.info(f"API response status code: {http_status_code}")

        if http_status_code == 200:
            logger.info(
                "Token has access to the repository. Checking write permissions."
            )
            permissions_url = f"{api_url}/collaborators/{repo_owner}/permission"
            logger.debug(f"Permissions check URL: {permissions_url}")
            permissions_command = [
                'curl', '-s', '-H', f'Authorization: Bearer {git_token}', '-H',
                'Accept: application/vnd.github+json', permissions_url
            ]
            logger.debug(
                f"Executing permissions check command: {' '.join(permissions_command)}"
            )
            permissions_result = subprocess.run(permissions_command,
                                                capture_output=True,
                                                text=True)
            permissions_data = permissions_result.stdout.strip()
            logger.debug(f"Permissions data: {permissions_data}")

            has_write_access = any(perm in permissions_data
                                   for perm in ['admin', 'write', 'maintain'])
            logger.info(f"Write access: {has_write_access}")
            return has_write_access
        else:
            logger.warning(
                f"Token validation failed with status code: {http_status_code}"
            )
            return False
    except Exception as e:
        logger.exception(f"Error validating git token: {str(e)}")
        return False


def check_dev_mode():
    logger.info("Checking dev mode")
    settings = load_settings()
    if not settings:
        logger.warning("Settings not found")
        return False
    if 'gitRepo' not in settings:
        logger.warning("Git repo URL not found in settings")
        return False

    repo_url = settings['gitRepo']
    logger.info(f"Git repo URL from settings: {repo_url}")

    github_token = get_github_token()
    if not github_token:
        logger.warning("GitHub token not available")
        return False

    is_dev_mode = validate_git_token(repo_url, github_token)
    logger.info(f"Dev mode status: {is_dev_mode}")
    return is_dev_mode
