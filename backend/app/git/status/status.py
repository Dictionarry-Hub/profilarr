# git/status/status.py

import git
from git.exc import GitCommandError, InvalidGitRepositoryError
import logging
import json
from .incoming_changes import get_incoming_changes
from .outgoing_changes import get_outgoing_changes

logger = logging.getLogger(__name__)

def get_commits_ahead(repo, branch):
    return list(repo.iter_commits(f'origin/{branch}..{branch}'))

def get_commits_behind(repo, branch):
    return list(repo.iter_commits(f'{branch}..origin/{branch}'))

def get_git_status(repo_path):
    try:
        logger.debug(f"Attempting to get status for repo at {repo_path}")
        repo = git.Repo(repo_path)
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
        logger.error(f"InvalidGitRepositoryError for path: {repo_path}")
        return False, "Invalid Git repository"
    except Exception as e:
        logger.error(f"Unexpected error in get_git_status: {str(e)}", exc_info=True)
        return False, f"Unexpected error: {str(e)}"