# git/status/status.py
import git
from git.exc import GitCommandError, InvalidGitRepositoryError
import logging
from .incoming_changes import get_incoming_changes
from .outgoing_changes import get_outgoing_changes
from .merge_conflicts import get_merge_conflicts
from .utils import determine_type
import os
import yaml

logger = logging.getLogger(__name__)


def get_commits_ahead(repo, branch):
    return list(repo.iter_commits(f'origin/{branch}..{branch}'))


def get_commits_behind(repo, branch):
    return list(repo.iter_commits(f'{branch}..origin/{branch}'))


def get_unpushed_changes(repo, branch):
    """Get detailed info about files modified in unpushed commits"""
    try:
        # Get the file paths
        unpushed_files = repo.git.diff(f'origin/{branch}..{branch}',
                                       '--name-only').split('\n')
        unpushed_files = [f for f in unpushed_files if f]

        detailed_changes = []
        for file_path in unpushed_files:
            try:
                # Get the current content of the file to extract name
                with open(os.path.join(repo.working_dir, file_path), 'r') as f:
                    content = yaml.safe_load(f.read())

                detailed_changes.append({
                    'type':
                    determine_type(file_path),
                    'name':
                    content.get('name', os.path.basename(file_path)),
                    'file_path':
                    file_path
                })
            except Exception as e:
                logger.warning(
                    f"Could not get details for {file_path}: {str(e)}")
                # Fallback to basic info if we can't read the file
                detailed_changes.append({
                    'type': determine_type(file_path),
                    'name': os.path.basename(file_path),
                    'file_path': file_path
                })

        return detailed_changes
    except Exception as e:
        logger.error(f"Error getting unpushed changes: {str(e)}")
        return []


def get_git_status(repo_path):
    try:
        logger.debug(f"Attempting to get status for repo at {repo_path}")
        repo = git.Repo(repo_path)
        branch = repo.active_branch.name
        remote_branch_exists = f"origin/{branch}" in [
            ref.name for ref in repo.remotes.origin.refs
        ]

        # Check for merge state
        is_merging = os.path.exists(os.path.join(repo.git_dir, 'MERGE_HEAD'))

        # Get merge conflicts if we're in a merge state
        merge_conflicts = get_merge_conflicts(repo) if is_merging else []

        # Get all changes first
        outgoing_changes = get_outgoing_changes(repo)
        logger.debug(f"Outgoing changes detected: {outgoing_changes}")

        if remote_branch_exists:
            repo.remotes.origin.fetch()
            commits_behind = get_commits_behind(repo, branch)
            commits_ahead = get_commits_ahead(repo, branch)
            incoming_changes = get_incoming_changes(repo, branch)
            unpushed_files = get_unpushed_changes(
                repo, branch) if commits_ahead else []
        else:
            commits_behind = []
            commits_ahead = []
            incoming_changes = []
            unpushed_files = []

        status = {
            "branch": branch,
            "remote_branch_exists": remote_branch_exists,
            "outgoing_changes": outgoing_changes,
            "commits_behind": len(commits_behind),
            "commits_ahead": len(commits_ahead),
            "incoming_changes": incoming_changes,
            "has_unpushed_commits": len(commits_ahead) > 0,
            "unpushed_files": unpushed_files,
            "is_merging": is_merging,
            "merge_conflicts": merge_conflicts,
            "has_conflicts": bool(merge_conflicts)
        }
        return True, status
    except Exception as e:
        logger.error(f"Error in get_git_status: {str(e)}", exc_info=True)
        return False, str(e)
