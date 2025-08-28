# git/branches/checkout.py

import git
import logging
from ...arr.manager import check_active_sync_configs

logger = logging.getLogger(__name__)


def checkout_branch(repo_path, branch_name):
    try:
        # Check for active sync configurations first
        has_active_configs, configs = check_active_sync_configs()
        if has_active_configs:
            error_msg = (
                "Cannot checkout branch while automatic sync configurations are active.\n"
                "The following configurations must be set to manual sync first:\n"
            )
            for config in configs:
                error_msg += f"- {config['name']} (ID: {config['id']}, {config['sync_method']} sync)\n"

            logger.error(error_msg)
            return False, {
                "error": error_msg,
                "code": "ACTIVE_SYNC_CONFIGS",
                "configs": configs
            }

        logger.debug(f"Attempting to checkout branch: {branch_name}")
        repo = git.Repo(repo_path)

        # Check if the branch exists locally
        if branch_name in repo.heads:
            repo.git.checkout(branch_name)
        else:
            # Check if the branch exists in any of the remotes
            for remote in repo.remotes:
                remote_branch = f"{remote.name}/{branch_name}"
                if remote_branch in repo.refs:
                    # Create a new local branch tracking the remote branch
                    repo.git.checkout('-b', branch_name, remote_branch)
                    break
            else:
                return False, f"Branch '{branch_name}' does not exist locally or in any remote."

        logger.debug(f"Successfully checked out branch: {branch_name}")
        
        # Reload cache after branch checkout since files may have changed
        from ...data.cache import data_cache
        logger.info("Reloading data cache after branch checkout")
        data_cache.initialize(force_reload=True)
        
        return True, {
            "message": f"Checked out branch: {branch_name}",
            "current_branch": branch_name
        }
    except Exception as e:
        logger.error(f"Error checking out branch: {str(e)}", exc_info=True)
        return False, {"error": f"Error checking out branch: {str(e)}"}
