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
import threading
from datetime import datetime
from ...db import get_settings

logger = logging.getLogger(__name__)


class GitStatusManager:
    _instance = None
    _lock = threading.Lock()

    def __init__(self, repo_path):
        self.repo_path = repo_path
        self.repo = git.Repo(repo_path)
        self.status = {
            # Local status
            "branch": "",
            "outgoing_changes": [],
            "is_merging": False,
            "merge_conflicts": [],
            "has_conflicts": False,

            # Remote status
            "remote_branch_exists": False,
            "commits_behind": 0,
            "commits_ahead": 0,
            "incoming_changes": [],
            "has_unpushed_commits": False,
            "unpushed_files": [],

            # Metadata
            "last_local_update": None,
            "last_remote_update": None
        }

    @classmethod
    def get_instance(cls, repo_path=None):
        if not cls._instance and repo_path:
            with cls._lock:
                if not cls._instance:
                    cls._instance = cls(repo_path)
        return cls._instance

    def update_local_status(self):
        """Update only local repository status"""
        try:
            self.repo = git.Repo(self.repo_path)  # Refresh repo instance

            with self._lock:
                # Update branch
                self.status["branch"] = self.repo.active_branch.name

                # Check merge status
                self.status["is_merging"] = os.path.exists(
                    os.path.join(self.repo.git_dir, 'MERGE_HEAD'))

                # Get local changes
                self.status["outgoing_changes"] = get_outgoing_changes(
                    self.repo)

                # Get merge conflicts if merging
                self.status["merge_conflicts"] = (get_merge_conflicts(
                    self.repo) if self.status["is_merging"] else [])
                self.status["has_conflicts"] = bool(
                    self.status["merge_conflicts"])

                # Update timestamp
                self.status["last_local_update"] = datetime.now().isoformat()

            return True
        except Exception as e:
            logger.error(f"Error updating local status: {str(e)}")
            return False

    def update_remote_status(self):
        """Update remote repository status - called by scheduled task"""
        try:
            logger.info(
                f"Updating remote status for branch: {self.status['branch']}")

            # Do the fetch outside the lock
            self.repo.remotes.origin.fetch()

            # Get branch name safely
            with self._lock:
                branch = self.status["branch"]

            # Do git operations outside lock
            remote_refs = [ref.name for ref in self.repo.remotes.origin.refs]
            remote_branch_exists = f"origin/{branch}" in remote_refs

            if remote_branch_exists:
                commits_behind = list(
                    self.repo.iter_commits(f'{branch}..origin/{branch}'))
                commits_ahead = list(
                    self.repo.iter_commits(f'origin/{branch}..{branch}'))

                # Handle auto-pull before updating status
                if len(commits_behind) > 0:
                    logger.info(
                        f"Branch is {len(commits_behind)} commits behind")
                    try:
                        settings = get_settings()
                        if int(settings.get('auto_pull_enabled', 0)):
                            logger.info("Auto-pull enabled, pulling changes")
                            from ..operations.manager import GitOperations
                            git_ops = GitOperations(self.repo_path)
                            pull_result = git_ops.pull(branch)
                            logger.info(f"Auto-pull result: {pull_result}")
                            success, message = pull_result
                            if not success:
                                logger.error(f"Auto-pull failed: {message}")
                            # Refresh counts after pull
                            commits_behind = list(
                                self.repo.iter_commits(
                                    f'{branch}..origin/{branch}'))
                            commits_ahead = list(
                                self.repo.iter_commits(
                                    f'origin/{branch}..{branch}'))
                    except Exception as e:
                        logger.error(f"Error during auto-pull: {str(e)}")

                # Prepare the status update
                incoming = get_incoming_changes(self.repo, branch)
                unpushed = self._get_unpushed_changes(
                    branch) if commits_ahead else []

                # Only lock when updating the status
                with self._lock:
                    self.status.update({
                        "remote_branch_exists":
                        remote_branch_exists,
                        "commits_behind":
                        len(commits_behind),
                        "commits_ahead":
                        len(commits_ahead),
                        "has_unpushed_commits":
                        len(commits_ahead) > 0,
                        "incoming_changes":
                        incoming,
                        "unpushed_files":
                        unpushed,
                        "last_remote_update":
                        datetime.now().isoformat()
                    })
            else:
                with self._lock:
                    self.status.update({
                        "remote_branch_exists":
                        False,
                        "commits_behind":
                        0,
                        "commits_ahead":
                        0,
                        "has_unpushed_commits":
                        False,
                        "incoming_changes": [],
                        "unpushed_files": [],
                        "last_remote_update":
                        datetime.now().isoformat()
                    })

            return True
        except Exception as e:
            logger.error(f"Error updating remote status: {str(e)}")
            return False

    def _get_unpushed_changes(self, branch):
        """Get detailed info about files modified in unpushed commits"""
        try:
            unpushed_files = self.repo.git.diff(f'origin/{branch}..{branch}',
                                                '--name-only').split('\n')
            unpushed_files = [f for f in unpushed_files if f]

            detailed_changes = []
            for file_path in unpushed_files:
                try:
                    with open(os.path.join(self.repo.working_dir, file_path),
                              'r') as f:
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
                    detailed_changes.append({
                        'type': determine_type(file_path),
                        'name': os.path.basename(file_path),
                        'file_path': file_path
                    })

            return detailed_changes
        except Exception as e:
            logger.error(f"Error getting unpushed changes: {str(e)}")
            return []

    def get_status(self):
        """Get the current status without updating"""
        with self._lock:
            return self.status.copy()


def get_git_status(repo_path):
    try:
        status_manager = GitStatusManager.get_instance(repo_path)
        status_manager.update_local_status()
        return True, status_manager.get_status()
    except git.exc.InvalidGitRepositoryError:
        logger.info(f"No git repository found at {repo_path}")
        # Return a valid status object indicating no repo
        return True, {
            # Local status - empty/false everything
            "branch": "",
            "outgoing_changes": [],
            "is_merging": False,
            "merge_conflicts": [],
            "has_conflicts": False,

            # Remote status - explicitly show no repo/remote
            "remote_branch_exists": False,
            "commits_behind": 0,
            "commits_ahead": 0,
            "incoming_changes": [],
            "has_unpushed_commits": False,
            "unpushed_files": [],

            # Metadata
            "last_local_update": None,
            "last_remote_update": None,

            # New flag to explicitly indicate no repo
            "has_repo": False
        }
    except Exception as e:
        logger.error(f"Error in get_git_status: {str(e)}", exc_info=True)
        return False, str(e)
