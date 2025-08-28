# git/operations/delete.py

import os
import logging

logger = logging.getLogger(__name__)

def delete_file(repo_path, file_path):
    try:
        full_file_path = os.path.join(repo_path, file_path)

        if os.path.exists(full_file_path):
            os.remove(full_file_path)
            
            # Reload cache after file deletion
            from ...data.cache import data_cache
            data_cache.initialize(force_reload=True)
            
            message = f"File {file_path} has been deleted."
            return True, message
        else:
            return False, "File does not exist."
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}", exc_info=True)
        return False, f"Error deleting file: {str(e)}"