import os
import git
import logging

logger = logging.getLogger(__name__)

def get_diff(repo_path, file_path):
    try:
        repo = git.Repo(repo_path)
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

        return diff
    except Exception as e:
        logger.error(f"Error getting diff for file {file_path}: {str(e)}", exc_info=True)
        raise e