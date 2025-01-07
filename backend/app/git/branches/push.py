# git/branches/push.py
import git
import logging
from ..auth.authenticate import GitHubAuth

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


def _handle_git_error(error):
    """Helper function to process git errors and return user-friendly messages"""
    error_msg = str(error)
    if "403" in error_msg:
        return "Authentication failed: The provided PAT doesn't have sufficient permissions or is invalid."
    elif "401" in error_msg:
        return "Authentication failed: No PAT provided or the token is invalid."
    elif "non-fast-forward" in error_msg:
        return "Push rejected: Remote contains work that you do not have locally. Please pull the latest changes first."
    return f"Git error: {error_msg}"


def push_branch_to_remote(repo_path, branch_name):
    try:
        logger.debug(f"Attempting to push branch {branch_name} to remote")

        # Verify token before attempting push
        if not GitHubAuth.verify_token():
            return False, "Push operation requires GitHub authentication. Please configure PAT."

        repo = git.Repo(repo_path)

        # Check if the branch exists locally
        if branch_name not in repo.heads:
            return False, f"Branch '{branch_name}' does not exist locally."

        origin = repo.remote(name='origin')
        original_url = origin.url

        try:
            # Set authenticated URL
            auth_url = GitHubAuth.get_authenticated_url(original_url)
            origin.set_url(auth_url)

            # Push the branch to remote and set the upstream branch
            origin.push(refspec=f"{branch_name}:{branch_name}",
                        set_upstream=True)
            return True, f"Pushed branch to remote: {branch_name}"

        except git.GitCommandError as e:
            return False, _handle_git_error(e)

        finally:
            # Always restore original URL
            origin.set_url(original_url)

    except Exception as e:
        logger.error(f"Error pushing branch to remote: {str(e)}",
                     exc_info=True)
        return False, str(e)
