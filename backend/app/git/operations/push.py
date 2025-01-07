# git/operations/push.py
import git
import logging
from ..auth.authenticate import GitHubAuth
from ..status.status import GitStatusManager

logger = logging.getLogger(__name__)


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


def push_changes(repo_path):
    try:
        # Verify token before attempting push
        if not GitHubAuth.verify_token():
            return False, "Push operation requires GitHub authentication. Please configure PAT."

        repo = git.Repo(repo_path)
        origin = repo.remote(name='origin')
        original_url = origin.url

        try:
            # Set authenticated URL
            auth_url = GitHubAuth.get_authenticated_url(original_url)
            origin.set_url(auth_url)

            # Push changes
            push_info = origin.push()

            if push_info and push_info[0].flags & push_info[0].ERROR:
                raise git.GitCommandError("git push", push_info[0].summary)

            # Update remote status after successful push
            status_manager = GitStatusManager.get_instance(repo_path)
            if status_manager:
                status_manager.update_remote_status()

            return True, "Successfully pushed changes."

        finally:
            # Always restore original URL
            origin.set_url(original_url)

    except git.GitCommandError as e:
        logger.error(f"Git command error during push: {str(e)}")
        return False, _handle_git_error(e)
    except Exception as e:
        logger.error(f"Error pushing changes: {str(e)}", exc_info=True)
        return False, str(e)
