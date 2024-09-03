# git/authenticate.py

import subprocess
import logging

logger = logging.getLogger(__name__)

def validate_git_token(repo_url, git_token):
    try:
        parts = repo_url.strip('/').split('/')
        if len(parts) < 2:
            return False

        repo_owner, repo_name = parts[-2], parts[-1].replace('.git', '')
        api_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}"

        curl_command = [
            'curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
            '-H', f'Authorization: Bearer {git_token}',
            '-H', 'Accept: application/vnd.github+json',
            api_url
        ]

        result = subprocess.run(curl_command, capture_output=True, text=True)
        http_status_code = int(result.stdout.strip())

        if http_status_code == 200:
            return True
        elif http_status_code == 401:
            return False
        else:
            return False
    except Exception as e:
        return False