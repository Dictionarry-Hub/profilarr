# git/operations/operations.py

import git
from .stage import stage_files
from .commit import commit_changes
from .push import push_changes
from .revert import revert_file, revert_all
from .delete import delete_file
from .pull import pull_branch

class GitOperations:
    def __init__(self, repo_path):
        self.repo_path = repo_path

    def stage(self, files):
        return stage_files(self.repo_path, files)

    def commit(self, files, message):
        return commit_changes(self.repo_path, files, message)

    def push(self, files, message):
        return push_changes(self.repo_path, files, message)

    def revert(self, file_path):
        return revert_file(self.repo_path, file_path)

    def revert_all(self):
        return revert_all(self.repo_path)

    def delete(self, file_path):
        return delete_file(self.repo_path, file_path)

    def pull(self, branch_name):
        return pull_branch(self.repo_path, branch_name)