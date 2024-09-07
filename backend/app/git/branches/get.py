import git
import logging
from flask import Blueprint, jsonify

logger = logging.getLogger(__name__)

def get_branches(repo_path):
    try:
        logger.debug("Attempting to get branches")
        repo = git.Repo(repo_path)
        
        # Get local branches
        local_branches = [{'name': branch.name, 'isLocal': True, 'isRemote': False} for branch in repo.heads]
        logger.debug(f"Local branches found: {[branch['name'] for branch in local_branches]}")

        # Get remote branches
        remote_branches = [{'name': ref.remote_head, 'isLocal': False, 'isRemote': True} for ref in repo.remote().refs if not ref.remote_head == 'HEAD']
        logger.debug(f"Remote branches found: {[branch['name'] for branch in remote_branches]}")
        
        # Combine and update status for branches that are both local and remote
        all_branches = local_branches + remote_branches
        branch_dict = {}
        for branch in all_branches:
            if branch['name'] in branch_dict:
                branch_dict[branch['name']]['isLocal'] = branch_dict[branch['name']]['isLocal'] or branch['isLocal']
                branch_dict[branch['name']]['isRemote'] = branch_dict[branch['name']]['isRemote'] or branch['isRemote']
            else:
                branch_dict[branch['name']] = branch

        all_branches = list(branch_dict.values())
        
        logger.debug(f"All branches combined (local and remote): {[branch['name'] for branch in all_branches]}")
        logger.info(f"Branches being sent: {[branch['name'] for branch in all_branches]}")
        
        return True, {"branches": all_branches}
    except Exception as e:
        logger.error(f"Error getting branches: {str(e)}", exc_info=True)
        return False, {"error": f"Error getting branches: {str(e)}"}

def get_current_branch(repo_path):
    try:
        repo = git.Repo(repo_path)
        current_branch = repo.active_branch.name
        logger.debug(f"Current branch: {current_branch}")
        return current_branch
    except Exception as e:
        logger.error(f"Error getting current branch: {str(e)}", exc_info=True)
        return None
