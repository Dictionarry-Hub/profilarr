# git/clone_repo.py

import os
import shutil
import logging
import yaml
from git.exc import GitCommandError
import git
from ..auth.authenticate import GitHubAuth

logger = logging.getLogger(__name__)


def clone_repository(repo_url, repo_path):
    temp_dir = f"{repo_path}_temp"
    backup_dir = f"{repo_path}_backup"
    logger = logging.getLogger(__name__)

    try:
        # Initial clone attempt
        logger.info(f"Starting clone operation for {repo_url}")
        try:
            # First try without authentication (for public repos)
            repo = git.Repo.clone_from(repo_url, temp_dir)
            logger.info("Repository clone successful")
        except GitCommandError as e:
            error_str = str(e)
            # If authentication error, try with token
            if "could not read Username" in error_str or "Authentication failed" in error_str:
                logger.info("Initial clone failed due to authentication. Trying with token...")
                try:
                    # Verify token availability
                    if not GitHubAuth.verify_token():
                        logger.error("Private repository requires GitHub authentication. Please configure PAT.")
                        return False, "This appears to be a private repository. Please configure PROFILARR_PAT environment variable."
                    
                    # Get authenticated URL for private repositories
                    authenticated_url = GitHubAuth.get_authenticated_url(repo_url)
                    repo = git.Repo.clone_from(authenticated_url, temp_dir)
                    logger.info("Repository clone with authentication successful")
                except GitCommandError as auth_e:
                    logger.error(f"Clone with authentication failed: {str(auth_e)}")
                    return False, f"Failed to clone repository: {str(auth_e)}"
            # If repository not found, create new one
            elif "remote: Repository not found" in error_str:
                logger.info("Creating new repository - remote not found")
                repo = git.Repo.init(temp_dir)
                repo.create_remote('origin', repo_url)
            else:
                logger.error(f"Clone failed: {error_str}")
                return False, f"Failed to clone repository: {error_str}"

        # Check if repo is empty
        try:
            repo.head.reference
        except ValueError:
            logger.info("Initializing empty repository with default structure")
            _initialize_empty_repo(repo)

        # Backup handling
        if os.path.exists(repo_path):
            logger.info("Creating backup of existing repository")
            shutil.move(repo_path, backup_dir)

        # Move repo to final location
        logger.info("Moving repository to final location")
        shutil.move(temp_dir, repo_path)

        # Process folders
        for folder_name in ['regex_patterns', 'custom_formats', 'profiles']:
            folder_path = os.path.join(repo_path, folder_name)
            backup_folder_path = os.path.join(backup_dir, folder_name)

            if not os.path.exists(folder_path):
                logger.debug(f"Creating folder: {folder_name}")
                os.makedirs(folder_path)

            # File merging process
            cloned_files = set(
                f.replace('.yml', '') for f in os.listdir(folder_path)
                if f.endswith('.yml'))

            if os.path.exists(backup_folder_path):
                local_files = [
                    f for f in os.listdir(backup_folder_path)
                    if f.endswith('.yml')
                ]

                if local_files:
                    logger.info(
                        f"Merging {len(local_files)} files in {folder_name}")

                for file_name in local_files:
                    old_file_path = os.path.join(backup_folder_path, file_name)
                    with open(old_file_path, 'r') as file:
                        data = yaml.safe_load(file)

                    base_name = data['name']
                    new_name = base_name
                    counter = 1

                    while new_name in cloned_files:
                        new_name = f"{base_name} ({counter})"
                        counter += 1

                    cloned_files.add(new_name)
                    new_file_path = os.path.join(folder_path,
                                                 f"{new_name}.yml")

                    with open(new_file_path, 'w') as file:
                        yaml.dump(data, file)
                    logger.debug(f"Merged file: {file_name} → {new_name}.yml")

        # Cleanup
        if os.path.exists(backup_dir):
            logger.info("Removing backup directory")
            shutil.rmtree(backup_dir)

        # Reload cache after clone operation
        from ...data.cache import data_cache
        logger.info("Reloading data cache after clone")
        data_cache.initialize(force_reload=True)

        logger.info("Clone operation completed successfully")
        return True, "Repository cloned and local files merged successfully"

    except Exception as e:
        logger.exception("Critical error during clone operation")
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        if os.path.exists(backup_dir):
            shutil.move(backup_dir, repo_path)
        return False, f"Critical error: {str(e)}"


def _initialize_empty_repo(repo):
    # Create basic folder structure
    os.makedirs(os.path.join(repo.working_tree_dir, 'regex_patterns'),
                exist_ok=True)
    os.makedirs(os.path.join(repo.working_tree_dir, 'custom_formats'),
                exist_ok=True)
    os.makedirs(os.path.join(repo.working_tree_dir, 'quality_profiles'),
                exist_ok=True)

    # Create a README file
    with open(os.path.join(repo.working_tree_dir, 'README.md'), 'w') as f:
        f.write(
            "# Profilarr Repository\n\nThis repository contains regex patterns, custom formats and quality profiles."
        )

    repo.git.add(A=True)
    repo.index.commit("Initial commit: Basic repository structure")
    repo.create_head('main')
    repo.heads.main.checkout()
    origin = repo.remote(name='origin')
    origin.push('main')
    origin.push('main:main')

    logger.info(
        f"Initialized empty repository with basic structure and pushed to main"
    )
