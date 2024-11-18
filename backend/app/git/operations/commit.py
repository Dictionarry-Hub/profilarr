# git/operations/commit.py
import git
import os
import logging

logger = logging.getLogger(__name__)


def parse_git_status(status_output):
    """
    Parse git status --porcelain output into a structured format.
    
    Returns dict with staged and unstaged changes, identifying status of each file.
    """
    changes = {}
    for line in status_output:
        if not line:
            continue

        index_status = line[0]  # First character: staged status
        worktree_status = line[1]  # Second character: unstaged status
        file_path = line[3:]

        changes[file_path] = {
            'staged': index_status != ' ',
            'staged_status': index_status,
            'unstaged_status': worktree_status
        }

    return changes


def commit_changes(repo_path, files, message):
    """
    Commit changes to git repository, optimizing staging operations.
    Only re-stages files if their current staging status is incorrect.
    
    Args:
        repo_path: Path to git repository
        files: List of files to commit, or None/empty for all staged changes
        message: Commit message
        
    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        repo = git.Repo(repo_path)

        # If no specific files provided, commit all staged changes
        if not files:
            commit = repo.index.commit(message)
            return True, "Successfully committed all staged changes."

        # Get current status of the repository
        status_output = repo.git.status('--porcelain').splitlines()
        status = parse_git_status(status_output)

        # Track files that need staging operations
        to_add = []
        to_remove = []
        already_staged = []

        for file_path in files:
            if file_path in status:
                file_status = status[file_path]

                # File is already properly staged
                if file_status['staged']:
                    if file_status['staged_status'] == 'D':
                        already_staged.append(('deleted', file_path))
                    else:
                        already_staged.append(('modified', file_path))
                    continue

                # File needs to be staged
                if file_status['unstaged_status'] == 'D':
                    to_remove.append(file_path)
                else:
                    to_add.append(file_path)
            else:
                logger.warning(f"File not found in git status: {file_path}")

        # Perform necessary staging operations
        if to_add:
            logger.debug(f"Staging modified files: {to_add}")
            repo.index.add(to_add)

        if to_remove:
            logger.debug(f"Staging deleted files: {to_remove}")
            repo.index.remove(to_remove, working_tree=True)

        # Commit the changes
        commit = repo.index.commit(message)

        # Build detailed success message
        staged_counts = {
            'added/modified': len(to_add),
            'deleted': len(to_remove),
            'already_staged': len(already_staged)
        }

        message_parts = []
        if staged_counts['added/modified']:
            message_parts.append(
                f"{staged_counts['added/modified']} files staged")
        if staged_counts['deleted']:
            message_parts.append(
                f"{staged_counts['deleted']} deletions staged")
        if staged_counts['already_staged']:
            message_parts.append(
                f"{staged_counts['already_staged']} files already staged")

        if message_parts:
            details = " and ".join(message_parts)
            return True, f"Successfully committed changes ({details})"
        else:
            return True, "Successfully committed changes (no files needed staging)"

    except git.exc.GitCommandError as e:
        logger.error(f"Git command error committing changes: {str(e)}",
                     exc_info=True)
        return False, f"Error committing changes: {str(e)}"
    except Exception as e:
        logger.error(f"Error committing changes: {str(e)}", exc_info=True)
        return False, f"Error committing changes: {str(e)}"
