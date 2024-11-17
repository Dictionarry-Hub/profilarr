# git/branches/branches.py

import git
import os
from .create import create_branch
from .checkout import checkout_branch
from .delete import delete_branch
from .get import get_branches, get_current_branch
from .push import push_branch_to_remote


class Branch_Manager:

    def __init__(self, repo_path):
        self.repo_path = repo_path

    def is_merging(self):
        repo = git.Repo(self.repo_path)
        return os.path.exists(os.path.join(repo.git_dir, 'MERGE_HEAD'))

    def create(self, branch_name, base_branch='main'):
        if self.is_merging():
            return False, {
                'error':
                'Cannot create branch while merging. Resolve conflicts first.'
            }
        return create_branch(self.repo_path, branch_name, base_branch)

    def checkout(self, branch_name):
        if self.is_merging():
            return False, {
                'error':
                'Cannot checkout while merging. Resolve conflicts first.'
            }
        return checkout_branch(self.repo_path, branch_name)

    def delete(self, branch_name):
        if self.is_merging():
            return False, {
                'error':
                'Cannot delete branch while merging. Resolve conflicts first.'
            }
        return delete_branch(self.repo_path, branch_name)

    def get_all(self):
        return get_branches(self.repo_path)

    def get_current(self):
        return get_current_branch(self.repo_path)

    def push(self, branch_name):
        if self.is_merging():
            return False, {
                'error': 'Cannot push while merging. Resolve conflicts first.'
            }
        return push_branch_to_remote(self.repo_path, branch_name)
