# status/commit_history.py

import git
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def get_git_commit_history(repo_path, branch=None):
    """
    Get the commit history for the repository, optionally for a specific branch.
    
    Args:
        repo_path (str): Path to the git repository
        branch (str, optional): Branch name to get history for. Defaults to current branch.
        
    Returns:
        tuple: (success: bool, result: dict/str)
            On success, returns (True, {
                'local_commits': [...],
                'ahead_count': int,
                'behind_count': int
            })
            On failure, returns (False, error_message)
    """
    try:
        repo = git.Repo(repo_path)
        current_branch = repo.active_branch
        branch_to_check = branch if branch else current_branch.name

        # Get the tracking branch
        tracking_branch = None
        try:
            tracking_branch = repo.active_branch.tracking_branch()
        except Exception as e:
            logger.debug(f"No tracking branch found: {e}")

        # Get local commits
        commits = []
        try:
            # If we have a tracking branch, get commits since the divergence point
            if tracking_branch:
                merge_base = repo.merge_base(tracking_branch,
                                             current_branch)[0]
                commits = list(
                    repo.iter_commits(
                        f"{merge_base.hexsha}..{current_branch.name}"))
            else:
                # If no tracking branch, get recent commits (last 50)
                commits = list(
                    repo.iter_commits(current_branch.name, max_count=50))

            # Format commit information
            formatted_commits = []
            for commit in commits:
                # Check if it's a merge commit
                is_merge = len(commit.parents) > 1

                # Get the remote URL for the commit if possible
                remote_url = None
                if tracking_branch:
                    remote_url = repo.remote().url
                    if remote_url.endswith('.git'):
                        remote_url = remote_url[:-4]
                    remote_url += f"/commit/{commit.hexsha}"

                commit_info = {
                    'hash': commit.hexsha,
                    'message': commit.message.strip(),
                    'author': f"{commit.author.name} <{commit.author.email}>",
                    'date': commit.committed_datetime.isoformat(),
                    'isMerge': is_merge,
                    'remoteUrl': remote_url,
                    'details': {
                        'files_changed': [],
                        'insertions': 0,
                        'deletions': 0
                    }
                }

                # Get detailed stats
                try:
                    if len(commit.parents) > 0:
                        # Get the diff between this commit and its first parent
                        diff = commit.parents[0].diff(commit)

                        # Initialize stats
                        stats = {
                            'files_changed': [],
                            'insertions': 0,
                            'deletions': 0
                        }

                        # Get the total diff stats using git diff --numstat
                        raw_stats = repo.git.diff(commit.parents[0].hexsha,
                                                  commit.hexsha,
                                                  numstat=True).splitlines()

                        for line in raw_stats:
                            if not line.strip():
                                continue
                            adds, dels, file_path = line.split('\t')
                            # Handle binary files which show up as '-' in numstat
                            if adds != '-' and dels != '-':
                                stats['insertions'] += int(adds)
                                stats['deletions'] += int(dels)
                            stats['files_changed'].append(file_path)

                        commit_info['details'] = stats

                except Exception as e:
                    logger.debug(f"Error getting commit details: {e}")
                    commit_info['details'] = {
                        'files_changed': [],
                        'insertions': 0,
                        'deletions': 0
                    }

                formatted_commits.append(commit_info)

            # Get ahead/behind counts
            ahead_count = 0
            behind_count = 0
            if tracking_branch:
                ahead_count = len(
                    list(
                        repo.iter_commits(
                            f"{tracking_branch.name}..{current_branch.name}")))
                behind_count = len(
                    list(
                        repo.iter_commits(
                            f"{current_branch.name}..{tracking_branch.name}")))

            return True, {
                'local_commits': formatted_commits,
                'ahead_count': ahead_count,
                'behind_count': behind_count,
                'branch': branch_to_check,
                'has_remote': tracking_branch is not None
            }

        except git.GitCommandError as e:
            logger.error(f"Git command error while getting commits: {e}")
            return False, f"Error getting commits: {str(e)}"

    except Exception as e:
        logger.exception("Error getting commit history")
        return False, f"Unexpected error getting commit history: {str(e)}"
