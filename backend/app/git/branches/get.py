# git/branches/get.py

import git
import logging
from flask import Blueprint, jsonify

logger = logging.getLogger(__name__)

def get_branches(repo_path):
    try:
        logger.debug("Attempting to get branches")
        repo = git.Repo(repo_path)
        
        # Get local branches
        local_branches = [{'name': branch.name} for branch in repo.heads]
        
        # Get remote branches
        remote_branches = [{'name': ref.remote_head} for ref in repo.remote().refs]
        
        # Combine and remove duplicates, and exclude 'HEAD'
        all_branches = {branch['name']: branch for branch in local_branches + remote_branches if branch['name'] != 'HEAD'}.values()
        
        logger.debug(f"Successfully retrieved branches: {[branch['name'] for branch in all_branches]}")
        
        # Log the branches before sending
        logger.info(f"Branches being sent: {[branch['name'] for branch in all_branches]}")
        
        return True, {"branches": list(all_branches)}
    except Exception as e:
        logger.error(f"Error getting branches: {str(e)}", exc_info=True)
        return False, {"error": f"Error getting branches: {str(e)}"}

def get_current_branch(repo_path):
    try:
        repo = git.Repo(repo_path)
        return repo.active_branch.name
    except Exception as e:
        logger.error(f"Error getting current branch: {str(e)}", exc_info=True)
        return None