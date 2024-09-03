# git/branches/branches.py

import git
from .create import create_branch
from .checkout import checkout_branch
from .delete import delete_branch
from .get import get_branches, get_current_branch

class Branch_Manager:
    def __init__(self, repo_path):
        self.repo_path = repo_path

    def create(self, branch_name, base_branch='main'):
        return create_branch(self.repo_path, branch_name, base_branch)

    def checkout(self, branch_name):
        return checkout_branch(self.repo_path, branch_name)

    def delete(self, branch_name):
        return delete_branch(self.repo_path, branch_name)

    def get_all(self):
        return get_branches(self.repo_path)

    def get_current(self):
        return get_current_branch(self.repo_path)