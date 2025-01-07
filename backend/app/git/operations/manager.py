import git
from .stage import stage_files
from .commit import commit_changes
from .push import push_changes
from .revert import revert_file, revert_all
from .delete import delete_file
from .pull import pull_branch
from .unstage import unstage_files
from .merge import abort_merge, finalize_merge
from .resolve import resolve_conflicts
import logging

logger = logging.getLogger(__name__)


class GitOperations:

    def __init__(self, repo_path):
        self.repo_path = repo_path

    def stage(self, files):
        return stage_files(self.repo_path, files)

    def unstage(self, files):
        return unstage_files(self.repo_path, files)

    def commit(self, files, message):
        return commit_changes(self.repo_path, files, message)

    def push(self):
        return push_changes(self.repo_path)

    def revert(self, file_path):
        return revert_file(self.repo_path, file_path)

    def revert_all(self):
        return revert_all(self.repo_path)

    def delete(self, file_path):
        return delete_file(self.repo_path, file_path)

    def pull(self, branch_name):
        return pull_branch(self.repo_path, branch_name)

    def finalize_merge(self):
        repo = git.Repo(self.repo_path)
        return finalize_merge(repo)

    def abort_merge(self):
        return abort_merge(self.repo_path)

    def resolve(self, resolutions):
        repo = git.Repo(self.repo_path)
        return resolve_conflicts(repo, resolutions)
