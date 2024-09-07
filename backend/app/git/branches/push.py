import git
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

def push_branch_to_remote(repo_path, branch_name):
    try:
        logger.debug(f"Attempting to push branch {branch_name} to remote")
        repo = git.Repo(repo_path)
        
        # Check if the branch exists locally
        if branch_name not in repo.heads:
            return False, f"Branch '{branch_name}' does not exist locally."
        
        # Push the branch to remote and set the upstream branch
        origin = repo.remote(name='origin')
        origin.push(refspec=f"{branch_name}:{branch_name}", set_upstream=True)
        
        logger.debug(f"Successfully pushed branch to remote: {branch_name}")
        return True, {"message": f"Pushed branch to remote: {branch_name}"}
    except git.GitCommandError as e:
        logger.error(f"Git command error pushing branch to remote: {str(e)}", exc_info=True)
        return False, {"error": f"Error pushing branch to remote: {str(e)}"}
    except Exception as e:
        logger.error(f"Error pushing branch to remote: {str(e)}", exc_info=True)
        return False, {"error": f"Error pushing branch to remote: {str(e)}"}
