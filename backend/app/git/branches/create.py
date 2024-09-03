# git/branches/create.py

import git
import logging

logger = logging.getLogger(__name__)

def create_branch(repo_path, branch_name, base_branch='main'):
    try:
        logger.debug(f"Attempting to create branch {branch_name} from {base_branch}")
        repo = git.Repo(repo_path)

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