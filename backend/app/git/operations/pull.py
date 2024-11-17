import git
import logging
from git import GitCommandError
from ..status.status import get_git_status

logger = logging.getLogger(__name__)


def pull_branch(repo_path, branch_name):
    try:
        repo = git.Repo(repo_path)

        # Check for uncommitted changes first
        if repo.is_dirty(untracked_files=True):
            return False, {
                'type': 'uncommitted_changes',
                'message':
                'Cannot pull: You have uncommitted local changes that would be lost',
                'details': 'Please commit or stash your changes before pulling'
            }

        try:
            # Fetch first to get remote changes
            repo.remotes.origin.fetch()

            try:
                # Try to pull with explicit merge strategy
                repo.git.pull('origin', branch_name, '--no-rebase')
                return True, "Successfully pulled changes for branch {branch_name}"
            except GitCommandError as e:
                if "CONFLICT" in str(e):
                    # Don't reset - let Git stay in merge conflict state
                    return True, {
                        'state': 'resolve',
                        'type': 'merge_conflict',
                        'message':
                        'Repository is now in conflict resolution state. Please resolve conflicts to continue merge.',
                        'details': 'Please resolve conflicts to continue merge'
                    }
                raise e

        except GitCommandError as e:
            logger.error(f"Git command error pulling branch: {str(e)}",
                         exc_info=True)
            return False, f"Error pulling branch: {str(e)}"

    except Exception as e:
        logger.error(f"Error pulling branch: {str(e)}", exc_info=True)
        return False, f"Error pulling branch: {str(e)}"
