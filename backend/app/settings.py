import os
import yaml
import git
from flask import Blueprint, request, jsonify
from git.exc import GitCommandError, InvalidGitRepositoryError
import shutil
import subprocess
import logging
from datetime import datetime
import json
import requests

logging.basicConfig(level=logging.DEBUG)
logging.getLogger('git').setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

bp = Blueprint('settings', __name__, url_prefix='/settings')

DATA_DIR = '/app/data'
DB_DIR = os.path.join(DATA_DIR, 'db')
REGEX_DIR = os.path.join(DB_DIR, 'regex_patterns')
FORMAT_DIR = os.path.join(DB_DIR, 'custom_formats')
SETTINGS_FILE = os.path.join(DATA_DIR, 'config', 'settings.yml')

def load_settings():
    try:
        if not os.path.exists(SETTINGS_FILE):
            return None  # Indicate that the settings file does not exist

        with open(SETTINGS_FILE, 'r') as file:
            settings = yaml.safe_load(file)
            return settings if settings else None
    except Exception as e:
        return None

def save_settings(settings):
    try:
        os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
        with open(SETTINGS_FILE, 'w') as file:
            yaml.dump(settings, file)
    except Exception as e:
        pass

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

def get_outgoing_changes(repo):
    status = repo.git.status('--porcelain', '-z').split('\0')
    logger.debug(f"Raw porcelain status: {status}")

    changes = []
    for item in status:
        if not item:
            continue

        logger.debug(f"Processing status item: {item}")

        if len(item) < 4:
            logger.warning(f"Unexpected status item format: {item}")
            continue

        x, y, file_path = item[0], item[1], item[3:]
        logger.debug(f"Parsed status: x={x}, y={y}, file_path={file_path}")

        is_staged = x != ' ' and x != '?'
        is_deleted = x == 'D' or y == 'D'

        full_path = os.path.join(repo.working_dir, file_path)

        if is_deleted:
            try:
                # Get the content of the file from the last commit
                file_content = repo.git.show(f'HEAD:{file_path}')
                yaml_content = yaml.safe_load(file_content)
                original_name = yaml_content.get('name', 'Unknown')
                original_id = yaml_content.get('id', '')
            except Exception as e:
                logger.warning(f"Could not retrieve original name for deleted file {file_path}: {str(e)}")
                original_name = "Unknown"
                original_id = ""

            changes.append({
                'name': original_name,
                'id': original_id,
                'type': determine_type(file_path),
                'status': 'Deleted',
                'file_path': file_path,
                'staged': is_staged,
                'modified': False,
                'deleted': True
            })
        elif os.path.isdir(full_path):
            logger.debug(f"Found directory: {file_path}, going through folder.")
            for root, dirs, files in os.walk(full_path):
                for file in files:
                    if file.endswith('.yml') or file.endswith('.yaml'):
                        file_full_path = os.path.join(root, file)
                        logger.debug(f"Found file: {file_full_path}, going through file.")
                        file_data = extract_data_from_yaml(file_full_path)
                        if file_data:
                            logger.debug(f"File contents: {file_data}")
                            logger.debug(f"Found ID: {file_data.get('id')}")
                            logger.debug(f"Found Name: {file_data.get('name')}")
                            changes.append({
                                'name': file_data.get('name', ''),
                                'id': file_data.get('id', ''),
                                'type': determine_type(file_path),
                                'status': interpret_git_status(x, y),
                                'file_path': os.path.relpath(file_full_path, repo.working_dir),
                                'staged': x != '?' and x != ' ',
                                'modified': y == 'M',
                                'deleted': False
                            })
                        else:
                            logger.debug(f"No data extracted from file: {file_full_path}")
        else:
            file_data = extract_data_from_yaml(full_path) if os.path.exists(full_path) else None
            if file_data:
                changes.append({
                    'name': file_data.get('name', ''),
                    'id': file_data.get('id', ''),
                    'type': determine_type(file_path),
                    'status': interpret_git_status(x, y),
                    'file_path': file_path,
                    'staged': is_staged,
                    'modified': y != ' ',
                    'deleted': False
                })
            else:
                changes.append({
                    'name': os.path.basename(file_path).replace('.yml', ''),
                    'id': '',
                    'type': determine_type(file_path),
                    'status': interpret_git_status(x, y),
                    'file_path': file_path,
                    'staged': is_staged,
                    'modified': y != ' ',
                    'deleted': False
                })

    logger.debug(f"Final changes: {json.dumps(changes, indent=2)}")
    return changes

def get_incoming_changes(repo, branch):
    incoming_changes = []
    diff = repo.git.diff(f'HEAD...origin/{branch}', name_only=True)
    changed_files = diff.split('\n') if diff else []
    
    for file_path in changed_files:
        if file_path:
            full_path = os.path.join(repo.working_dir, file_path)
            file_data = extract_data_from_yaml(full_path) if os.path.exists(full_path) else None
            
            # Correcting the git show command
            commit_message = repo.git.show(f'HEAD...origin/{branch}', '--format=%B', '-s', file_path).strip()
            
            incoming_changes.append({
                'name': file_data.get('name', os.path.basename(file_path)) if file_data else os.path.basename(file_path),
                'id': file_data.get('id') if file_data else None,
                'type': determine_type(file_path),
                'status': 'Incoming',
                'file_path': file_path,
                'commit_message': commit_message,  # Include commit message here
                'staged': False,
                'modified': True,
                'deleted': False
            })
    
    return incoming_changes



def extract_data_from_yaml(file_path):
    logger.debug(f"Extracting data from file: {file_path}")
    try:
        with open(file_path, 'r') as f:
            content = yaml.safe_load(f)
            logger.debug(f"File content: {content}")  # Log the full file content
            if content is None:
                logger.error(f"Failed to parse YAML file or file is empty: {file_path}")
                return None
            
            # Check if expected keys are in the content
            if 'name' not in content or 'id' not in content:
                logger.warning(f"'name' or 'id' not found in file: {file_path}")
            
            return {
                'name': content.get('name'),
                'id': content.get('id')
            }
    except Exception as e:
        logger.warning(f"Error reading file {file_path}: {str(e)}")
        return None


def determine_type(file_path):
    if 'regex_patterns' in file_path:
        return 'Regex Pattern'
    elif 'custom_formats' in file_path:
        return 'Custom Format'
    elif 'profiles' in file_path:
        return 'Quality Profile'
    return 'Unknown'

def interpret_git_status(x, y):
    if x == 'D' or y == 'D':
        return 'Deleted'
    elif x == 'A':
        return 'Added'
    elif x == 'M' or y == 'M':
        return 'Modified'
    elif x == 'R':
        return 'Renamed'
    elif x == 'C':
        return 'Copied'
    elif x == 'U':
        return 'Updated but unmerged'
    elif x == '?' and y == '?':
        return 'Untracked'
    else:
        return 'Unknown'

def get_staged_files(repo):
    return [item.a_path for item in repo.index.diff('HEAD')]

def get_commits_ahead(repo, branch):
    return list(repo.iter_commits(f'origin/{branch}..{branch}'))

def get_commits_behind(repo, branch):
    return list(repo.iter_commits(f'{branch}..origin/{branch}'))

class SettingsManager:
    def __init__(self):
        self.settings = load_settings()
        self.repo_url = self.settings.get('gitRepo') if self.settings else None
        self.repo_path = DB_DIR

    def get_default_branch(self):
        try:
            logger.info(f"Fetching default branch for repo: {self.repo_url}")
            parts = self.repo_url.strip('/').split('/')
            if len(parts) < 2:
                logger.error("Invalid repository URL")
                return None

            repo_owner, repo_name = parts[-2], parts[-1].replace('.git', '')
            api_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}"

            headers = {
                'Authorization': f'Bearer {self.settings["gitToken"]}',
                'Accept': 'application/vnd.github+json'
            }
            response = requests.get(api_url, headers=headers)
            
            if response.status_code == 200:
                repo_info = response.json()
                default_branch = repo_info.get('default_branch', 'main')
                logger.info(f"Default branch: {default_branch}")
                return default_branch
            else:
                logger.error(f"Failed to fetch default branch, status code: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Error fetching default branch: {str(e)}", exc_info=True)
            return None

    def clone_repository(self):
        try:
            if not validate_git_token(self.repo_url, self.settings["gitToken"]):
                logger.error("Invalid Git token provided")
                return False, "Invalid Git token. Please check your credentials and try again."

            default_branch = self.get_default_branch()
            if not default_branch:
                logger.error("Unable to determine the default branch")
                return False, "Unable to determine the default branch."

            temp_dir = f"{self.repo_path}_temp"
            backup_dir = f"{self.repo_path}_backup"
            
            logger.info(f"Cloning repository from {self.repo_url} to {temp_dir}")
            auth_repo_url = self.repo_url.replace('https://', f'https://{self.settings["gitToken"]}:x-oauth-basic@')
            
            try:
                git.Repo.clone_from(auth_repo_url, temp_dir, branch=default_branch, single_branch=True)
            except GitCommandError as e:
                logger.error(f"Git clone failed: {str(e)}")
                return False, f"Failed to clone repository: {str(e)}"

            if os.path.exists(self.repo_path):
                logger.info(f"Backing up existing repo to {backup_dir}")
                shutil.move(self.repo_path, backup_dir)

            logger.info(f"Moving cloned repo from {temp_dir} to {self.repo_path}")
            shutil.move(temp_dir, self.repo_path)

            for folder_name in ['regex_patterns', 'custom_formats']:
                folder_path = os.path.join(self.repo_path, folder_name)
                backup_folder_path = os.path.join(backup_dir, folder_name)

                if not os.path.exists(folder_path):
                    logger.info(f"Creating missing folder: {folder_name}")
                    os.makedirs(folder_path)

                # Collect IDs from the cloned files
                cloned_files = [f for f in os.listdir(folder_path) if f.endswith('.yml')]
                cloned_ids = set(int(f.split('.')[0]) for f in cloned_files)

                # Handle local files from the backup directory
                if os.path.exists(backup_folder_path):
                    local_files = [f for f in os.listdir(backup_folder_path) if f.endswith('.yml')]
                    for file_name in local_files:
                        old_file_path = os.path.join(backup_folder_path, file_name)
                        with open(old_file_path, 'r') as file:
                            data = yaml.safe_load(file)

                        # Increment the ID only if it's already in the cloned set
                        while data['id'] in cloned_ids:
                            data['id'] += 1

                        cloned_ids.add(data['id'])  # Add to the set to track used IDs

                        new_file_name = f"{data['id']}_{data['name'].replace(' ', '_').lower()}.yml"
                        new_file_path = os.path.join(folder_path, new_file_name)
                        with open(new_file_path, 'w') as file:
                            yaml.dump(data, file)
                        logger.info(f"Merged local file: {new_file_name}")

            if os.path.exists(backup_dir):
                logger.info(f"Removing backup directory: {backup_dir}")
                shutil.rmtree(backup_dir)

            logger.info("Repository cloned and set up successfully")
            return True, "Repository cloned successfully and local files updated"
        except Exception as e:
            logger.exception("Unexpected error during repository cloning")
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            if os.path.exists(backup_dir):
                shutil.move(backup_dir, self.repo_path)
            return False, f"Unexpected error: {str(e)}"
    

    def get_git_status(self):
        try:
            logger.debug(f"Attempting to get status for repo at {self.repo_path}")
            repo = git.Repo(self.repo_path)
            logger.debug(f"Successfully created Repo object")

            outgoing_changes = get_outgoing_changes(repo)
            logger.debug(f"Outgoing changes detected: {outgoing_changes}")

            branch = repo.active_branch.name
            remote_branch_exists = f"origin/{branch}" in [ref.name for ref in repo.remotes.origin.refs]

            if remote_branch_exists:
                repo.remotes.origin.fetch()
                commits_behind = get_commits_behind(repo, branch)
                commits_ahead = get_commits_ahead(repo, branch)
                logger.debug(f"Commits behind: {len(commits_behind)}, Commits ahead: {len(commits_ahead)}")

                incoming_changes = get_incoming_changes(repo, branch)
            else:
                commits_behind = []
                commits_ahead = []
                incoming_changes = []
                logger.debug("Remote branch does not exist, skipping commits ahead/behind and incoming changes calculation.")

            status = {
                "branch": branch,
                "remote_branch_exists": remote_branch_exists,
                "outgoing_changes": outgoing_changes,
                "commits_behind": len(commits_behind),
                "commits_ahead": len(commits_ahead),
                "incoming_changes": incoming_changes,
            }
            logger.debug(f"Final status object: {json.dumps(status, indent=2)}")
            return True, status
        except GitCommandError as e:
            logger.error(f"GitCommandError: {str(e)}")
            return False, f"Git error: {str(e)}"
        except InvalidGitRepositoryError:
            logger.error(f"InvalidGitRepositoryError for path: {self.repo_path}")
            return False, "Invalid Git repository"
        except Exception as e:
            logger.error(f"Unexpected error in get_git_status: {str(e)}", exc_info=True)
            return False, f"Unexpected error: {str(e)}"


    
    def get_branches(self):
        try:
            logger.debug("Attempting to get branches")
            repo = git.Repo(self.repo_path)
            
            # Get local branches
            local_branches = [{'name': branch.name} for branch in repo.heads]
            
            # Get remote branches
            remote_branches = [{'name': ref.remote_head} for ref in repo.remote().refs]
            
            # Combine and remove duplicates, and exclude 'HEAD'
            all_branches = {branch['name']: branch for branch in local_branches + remote_branches if branch['name'] != 'HEAD'}.values()
            
            logger.debug(f"Successfully retrieved branches: {[branch['name'] for branch in all_branches]}")
            
            # Log the branches before sending
            logger.info(f"Branches being sent: {[branch['name'] for branch in all_branches]}")
            
            return True, {"branches": list(all_branches)}
        except Exception as e:
            logger.error(f"Error getting branches: {str(e)}", exc_info=True)
            return False, {"error": f"Error getting branches: {str(e)}"}





    def create_branch(self, branch_name, base_branch='main'):
        try:
            logger.debug(f"Attempting to create branch {branch_name} from {base_branch}")
            repo = git.Repo(self.repo_path)

            # Check if the branch already exists
            if branch_name in repo.heads:
                return False, f"Branch '{branch_name}' already exists."

            # Create and checkout the new branch
            new_branch = repo.create_head(branch_name, commit=base_branch)
            new_branch.checkout()

            # Push the new branch to remote and set the upstream branch
            origin = repo.remote(name='origin')
            origin.push(refspec=f"{branch_name}:{branch_name}", set_upstream=True)

            logger.debug(f"Successfully created and pushed branch: {branch_name}")
            return True, {"message": f"Created and set upstream for branch: {branch_name}", "current_branch": branch_name}
        except Exception as e:
            logger.error(f"Error creating branch: {str(e)}", exc_info=True)
            return False, {"error": f"Error creating branch: {str(e)}"}


    def checkout_branch(self, branch_name):
        try:
            logger.debug(f"Attempting to checkout branch: {branch_name}")
            repo = git.Repo(self.repo_path)

            # Check if the branch exists
            if branch_name not in repo.heads:
                return False, f"Branch '{branch_name}' does not exist."

            # Checkout the branch
            repo.git.checkout(branch_name)

            logger.debug(f"Successfully checked out branch: {branch_name}")
            return True, {"message": f"Checked out branch: {branch_name}", "current_branch": branch_name}
        except Exception as e:
            logger.error(f"Error checking out branch: {str(e)}", exc_info=True)
            return False, {"error": f"Error checking out branch: {str(e)}"}

    def delete_branch(self, branch_name):
        try:
            logger.debug(f"Attempting to delete branch: {branch_name}")
            repo = git.Repo(self.repo_path)

            # Check if the branch exists
            if branch_name not in repo.heads:
                return False, f"Branch '{branch_name}' does not exist."

            # Check if it's the current branch
            if repo.active_branch.name == branch_name:
                return False, f"Cannot delete the current branch: {branch_name}"

            # Delete the branch locally
            repo.delete_head(branch_name, force=True)

            # Delete the branch remotely
            try:
                repo.git.push('origin', '--delete', branch_name)
            except GitCommandError:
                logger.warning(f"Failed to delete remote branch: {branch_name}. It may not exist on remote.")

            logger.debug(f"Successfully deleted branch: {branch_name}")
            return True, {"message": f"Deleted branch: {branch_name}", "current_branch": repo.active_branch.name}
        except Exception as e:
            logger.error(f"Error deleting branch: {str(e)}", exc_info=True)
            return False, {"error": f"Error deleting branch: {str(e)}"}

    def get_current_branch(self):
        try:
            repo = git.Repo(self.repo_path)
            return repo.active_branch.name
        except Exception as e:
            logger.error(f"Error getting current branch: {str(e)}", exc_info=True)
            return None
        
    def stage_files(self, files):
        try:
            repo = git.Repo(self.repo_path)
            for file_path in files:
                repo.index.add([file_path])
            return True, "Successfully staged files."
        except Exception as e:
            logger.error(f"Error staging files: {str(e)}", exc_info=True)
            return False, f"Error staging files: {str(e)}"

    def push_files(self, files, commit_message):
        try:
            repo = git.Repo(self.repo_path)
            # Stage the files
            self.stage_files(files)

            # Commit the staged files
            repo.index.commit(commit_message)

            # Push the commit to the remote repository
            origin = repo.remote(name='origin')
            origin.push()

            return True, "Successfully committed and pushed files."
        except Exception as e:
            logger.error(f"Error pushing files: {str(e)}", exc_info=True)
            return False, f"Error pushing files: {str(e)}"

        
settings_manager = SettingsManager()

@bp.route('', methods=['GET'])
def handle_settings():
    settings = load_settings()
    if not settings:
        return jsonify({}), 204
    return jsonify(settings), 200

@bp.route('', methods=['POST'])
def update_settings():
    try:
        new_settings = request.json
        logger.info(f"Received new settings: {new_settings}")
        
        # Validate required fields
        required_fields = ['gitRepo', 'gitToken']
        for field in required_fields:
            if field not in new_settings:
                logger.error(f"Missing required field: {field}")
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Attempt to clone the repository before saving settings
        settings_manager.settings = new_settings
        settings_manager.repo_url = new_settings['gitRepo']
        success, message = settings_manager.clone_repository()
        
        if success:
            # Only save the settings if the clone was successful
            save_settings(new_settings)
            logger.info("Settings updated and repository cloned successfully")
            return jsonify(new_settings), 200
        else:
            if "Invalid Git token" in message:
                logger.warning("Invalid Git token provided")
                return jsonify({"error": message}), 401
            logger.error(f"Failed to clone repository: {message}")
            return jsonify({"error": message}), 400
    except Exception as e:
        logger.exception("Unexpected error in update_settings")
        return jsonify({"error": f"Failed to update settings: {str(e)}"}), 500

@bp.route('/status', methods=['GET'])
def get_status():
    logger.debug("Received request for git status")
    success, message = settings_manager.get_git_status()
    if success:
        logger.debug("Successfully retrieved git status")
        return jsonify({'success': True, 'data': message}), 200
    else:
        logger.error(f"Failed to retrieve git status: {message}")
        return jsonify({'success': False, 'error': message}), 400

# Update the route handlers
@bp.route('/branch', methods=['POST'])
def create_branch():
    branch_name = request.json.get('name')
    base_branch = request.json.get('base', 'main')
    logger.debug(f"Received request to create branch {branch_name} from {base_branch}")
    success, result = settings_manager.create_branch(branch_name, base_branch)
    if success:
        logger.debug(f"Successfully created branch: {branch_name}")
        return jsonify({'success': True, **result}), 200
    else:
        logger.error(f"Failed to create branch: {result}")
        return jsonify({'success': False, 'error': result}), 400
    
@bp.route('/branches', methods=['GET'])
def get_branches():
    logger.debug("Received request for branches")
    success, result = settings_manager.get_branches()
    if success:
        logger.debug("Successfully retrieved branches")
        return jsonify({'success': True, 'data': result}), 200
    else:
        logger.error(f"Failed to retrieve branches: {result}")
        return jsonify({'success': False, 'error': result}), 400

@bp.route('/checkout', methods=['POST'])
def checkout_branch():
    branch_name = request.json.get('branch')
    logger.debug(f"Received request to checkout branch: {branch_name}")
    success, result = settings_manager.checkout_branch(branch_name)
    if success:
        logger.debug(f"Successfully checked out branch: {branch_name}")
        return jsonify({'success': True, **result}), 200
    else:
        logger.error(f"Failed to checkout branch: {result}")
        return jsonify({'success': False, 'error': result}), 400

@bp.route('/branch/<branch_name>', methods=['DELETE'])
def delete_branch(branch_name):
    logger.debug(f"Received request to delete branch: {branch_name}")
    success, result = settings_manager.delete_branch(branch_name)
    if success:
        logger.debug(f"Successfully deleted branch: {branch_name}")
        return jsonify({'success': True, **result}), 200
    else:
        logger.error(f"Failed to delete branch: {result}")
        return jsonify({'success': False, 'error': result}), 400

@bp.route('/current-branch', methods=['GET'])
def get_current_branch():
    current_branch = settings_manager.get_current_branch()
    if current_branch:
        return jsonify({'success': True, 'current_branch': current_branch}), 200
    else:
        return jsonify({'success': False, 'error': 'Failed to get current branch'}), 400

@bp.route('/stage', methods=['POST'])
def stage_files():
    files = request.json.get('files', [])
    
    try:
        repo = git.Repo(settings_manager.repo_path)
        
        if not files:  # If no files are specified, stage all changes
            repo.git.add(A=True)  # This adds all changes to staging, including deletions
            message = "All changes have been staged."
        else:
            for file_path in files:
                # Staging a deleted file requires just adding the file path.
                repo.git.add(file_path)
            message = "Specified files have been staged."
        
        return jsonify({'success': True, 'message': message}), 200
    
    except Exception as e:
        logger.error(f"Error staging files: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': f"Error staging files: {str(e)}"}), 400


def generate_commit_message(user_message, files):
    file_changes = []
    for file in files:
        if 'regex_patterns' in file:
            file_changes.append(f"Update regex pattern: {file.split('/')[-1]}")
        elif 'custom_formats' in file:
            file_changes.append(f"Update custom format: {file.split('/')[-1]}")
        else:
            file_changes.append(f"Update: {file}")

    commit_message = f"{user_message}\n\nChanges:\n" + "\n".join(file_changes)
    return commit_message

@bp.route('/push', methods=['POST'])
def push_files():
    files = request.json.get('files', [])
    user_commit_message = request.json.get('commit_message', "Commit and push staged files")
    logger.debug(f"Received request to push files: {files}")
    
    try:
        repo = git.Repo(settings_manager.repo_path)
        
        # Instead of restaging the files, we directly commit the staged changes
        staged_files = repo.index.diff("HEAD")  # Get the list of staged files
        if not staged_files:
            return jsonify({'success': False, 'error': "No staged changes to commit."}), 400
        
        # Generate the structured commit message
        commit_message = generate_commit_message(user_commit_message, files)
        
        # Commit the staged changes
        repo.index.commit(commit_message)

        # Push the commit to the remote repository
        origin = repo.remote(name='origin')
        origin.push()

        logger.debug("Successfully committed and pushed files")
        return jsonify({'success': True, 'message': "Successfully committed and pushed files."}), 200
    
    except Exception as e:
        logger.error(f"Error pushing files: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': f"Error pushing files: {str(e)}"}), 400

@bp.route('/revert', methods=['POST'])
def revert_file():
    file_path = request.json.get('file_path')
    
    if not file_path:
        return jsonify({'success': False, 'error': "File path is required."}), 400
    
    try:
        repo = git.Repo(settings_manager.repo_path)
        
        # Check if the file is staged for deletion
        staged_deletions = repo.index.diff("HEAD", R=True)
        is_staged_for_deletion = any(d.a_path == file_path for d in staged_deletions)
        
        if is_staged_for_deletion:
            # If the file is staged for deletion, we need to unstage it and restore it
            repo.git.reset("--", file_path)  # Unstage the deletion
            repo.git.checkout('HEAD', "--", file_path)  # Restore the file from HEAD
            message = f"File {file_path} has been restored and unstaged from deletion."
        else:
            # For other changes, use the existing revert logic
            repo.git.restore("--", file_path)
            repo.git.restore('--staged', "--", file_path)
            message = f"File {file_path} has been reverted."
        
        return jsonify({'success': True, 'message': message}), 200
    
    except Exception as e:
        logger.error(f"Error reverting file: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': f"Error reverting file: {str(e)}"}), 400


@bp.route('/revert-all', methods=['POST'])
def revert_all():
    try:
        repo = git.Repo(settings_manager.repo_path)
        
        # Revert all files to the state of the last commit
        repo.git.restore('--staged', '.')
        repo.git.restore('.')
        
        return jsonify({'success': True, 'message': "All changes have been reverted to the last commit."}), 200
    
    except Exception as e:
        logger.error(f"Error reverting all changes: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': f"Error reverting all changes: {str(e)}"}), 400


@bp.route('/file', methods=['DELETE'])
def delete_file():
    file_path = request.json.get('file_path')

    if not file_path:
        return jsonify({'success': False, 'error': "File path is required."}), 400

    try:
        full_file_path = os.path.join(settings_manager.repo_path, file_path)
        
        if os.path.exists(full_file_path):
            os.remove(full_file_path)
            message = f"File {file_path} has been deleted."
            return jsonify({'success': True, 'message': message}), 200
        else:
            return jsonify({'success': False, 'error': "File does not exist."}), 404
    
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': f"Error deleting file: {str(e)}"}), 400
    
@bp.route('/pull', methods=['POST'])
def pull_branch():
    branch_name = request.json.get('branch')
    try:
        repo = git.Repo(settings_manager.repo_path)
        repo.git.pull('origin', branch_name)
        return jsonify({'success': True, 'message': f'Successfully pulled changes for branch {branch_name}.'}), 200
    except Exception as e:
        logger.error(f"Error pulling branch: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': f"Error pulling branch: {str(e)}"}), 400

@bp.route('/diff', methods=['POST'])
def get_diff():
    file_path = request.json.get('file_path')
    try:
        repo = git.Repo(settings_manager.repo_path)
        branch = repo.active_branch.name

        # Check if the file is untracked
        untracked_files = repo.untracked_files
        if file_path in untracked_files:
            with open(os.path.join(repo.working_dir, file_path), 'r') as file:
                content = file.read()
            diff = "\n".join([f"+{line}" for line in content.splitlines()])
        else:
            # Check if the file is deleted
            if not os.path.exists(os.path.join(repo.working_dir, file_path)):
                diff = "-Deleted File"
            else:
                # Get the diff for modified files
                diff = repo.git.diff(f'HEAD', file_path)

        logger.debug(f"Diff for file {file_path}: {diff}")
        return jsonify({'success': True, 'diff': diff if diff else ""}), 200
    except Exception as e:
        logger.error(f"Error getting diff for file {file_path}: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': f"Error getting diff for file: {str(e)}"}), 400