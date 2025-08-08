"""Main import module entry point."""
import logging
from typing import Dict, Any, List
from .strategies import FormatStrategy, ProfileStrategy

logger = logging.getLogger(__name__)


def handle_import_request(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle an import request.
    
    Args:
        request: Request dictionary containing:
            - arrID: ID of the arr_config to use
            - strategy: 'format' or 'profile'
            - filenames: List of filenames to import
            - dryRun: Optional boolean for dry-run mode (default: false)
            
    Returns:
        Import results with added/updated/failed counts
    """
    from ..db import get_db
    
    try:
        # Extract request parameters
        arr_id = request.get('arrID')
        strategy_type = request.get('strategy')
        filenames = request.get('filenames', [])
        dry_run = request.get('dryRun', False)
        
        # Validate inputs
        if not arr_id:
            return {
                'success': False,
                'error': 'arrID is required'
            }
        
        if strategy_type not in ['format', 'profile']:
            return {
                'success': False,
                'error': 'strategy must be "format" or "profile"'
            }
        
        if not filenames:
            return {
                'success': False,
                'error': 'filenames list is required'
            }
        
        # Load arr_config from database
        with get_db() as conn:
            cursor = conn.execute(
                "SELECT * FROM arr_config WHERE id = ?",
                (arr_id,)
            )
            arr_config = cursor.fetchone()
            
            if not arr_config:
                return {
                    'success': False,
                    'error': f'arr_config {arr_id} not found'
                }
        
        # Select strategy
        strategy_map = {
            'format': FormatStrategy,
            'profile': ProfileStrategy
        }
        
        strategy_class = strategy_map[strategy_type]
        strategy = strategy_class(arr_config)
        
        # Execute import
        logger.info(
            f"Processing {strategy_type} import for arr_config #{arr_id} ({arr_config['name']}): "
            f"{len(filenames)} items" + (" [DRY RUN]" if dry_run else "")
        )
        
        result = strategy.execute(filenames, dry_run=dry_run)
        
        added = result.get('added', 0)
        updated = result.get('updated', 0)
        failed = result.get('failed', 0)

        # Determine status
        is_partial = failed > 0 and (added > 0 or updated > 0)
        is_success = failed == 0

        result['success'] = is_success or is_partial
        if is_partial:
            result['status'] = "partial"
        elif is_success:
            result['status'] = "success"
        else:
            result['status'] = "failed"
        
        result['arr_config_id'] = arr_id
        result['arr_config_name'] = arr_config['name']
        result['strategy'] = strategy_type
        
        logger.info(
            f"Import complete - Added: {added}, "
            f"Updated: {updated}, "
            f"Failed: {failed}"
        )
        
        return result
        
    except Exception as e:
        logger.exception("Import request failed")
        return {
            'success': False,
            'error': str(e)
        }


def handle_scheduled_import(task_id: int) -> Dict[str, Any]:
    """
    Handle a scheduled import task.
    
    Args:
        task_id: ID from scheduled_tasks table
        
    Returns:
        Import results
    """
    from ..db import get_db
    import json
    
    try:
        # Find arr_config for this task
        with get_db() as conn:
            cursor = conn.execute(
                "SELECT * FROM arr_config WHERE import_task_id = ?",
                (task_id,)
            )
            arr_config = cursor.fetchone()
            
            if not arr_config:
                return {
                    'success': False,
                    'error': f'No arr_config found for task {task_id}'
                }
        
        # Parse data_to_sync
        data_to_sync = json.loads(arr_config['data_to_sync'] or '{}')
        
        # Build import requests
        results = []
        
        # Import custom formats
        format_names = data_to_sync.get('customFormats', [])
        if format_names:
            # Remove .yml extension if present
            format_names = [f.replace('.yml', '') for f in format_names]
            
            request = {
                'arrID': arr_config['id'],
                'strategy': 'format',
                'filenames': format_names
            }
            result = handle_import_request(request)
            results.append(result)
        
        # Import profiles
        profile_names = data_to_sync.get('profiles', [])
        if profile_names:
            # Remove .yml extension if present
            profile_names = [p.replace('.yml', '') for p in profile_names]
            
            request = {
                'arrID': arr_config['id'],
                'strategy': 'profile',
                'filenames': profile_names
            }
            result = handle_import_request(request)
            results.append(result)
        
        # Combine results
        total_added = sum(r.get('added', 0) for r in results)
        total_updated = sum(r.get('updated', 0) for r in results)
        total_failed = sum(r.get('failed', 0) for r in results)
        
        is_partial = total_failed > 0 and (total_added > 0 or total_updated > 0)
        is_success = total_failed == 0

        status = "failed"
        if is_partial:
            status = "partial"
        elif is_success:
            status = "success"

        combined_result = {
            'success': is_success or is_partial,
            'status': status,
            'task_id': task_id,
            'arr_config_id': arr_config['id'],
            'arr_config_name': arr_config['name'],
            'added': total_added,
            'updated': total_updated,
            'failed': total_failed,
            'results': results
        }
        
        # Update sync status
        _update_sync_status(arr_config['id'], combined_result)
        
        return combined_result
        
    except Exception as e:
        logger.exception(f"Scheduled import {task_id} failed")
        return {
            'success': False,
            'error': str(e)
        }


def _update_sync_status(config_id: int, result: Dict[str, Any]) -> None:
    """Update arr_config sync status after scheduled import."""
    from ..db import get_db
    from datetime import datetime
    
    try:
        total = result.get('added', 0) + result.get('updated', 0) + result.get('failed', 0)
        successful = result.get('added', 0) + result.get('updated', 0)
        
        sync_percentage = int((successful / total * 100) if total > 0 else 0)
        
        with get_db() as conn:
            conn.execute("""
                UPDATE arr_config
                SET last_sync_time = ?,
                    sync_percentage = ?
                WHERE id = ?
            """, (datetime.now(), sync_percentage, config_id))
            conn.commit()
            
        logger.info(f"Updated sync status for arr_config #{config_id}: {sync_percentage}%")
        
    except Exception as e:
        logger.error(f"Failed to update sync status: {e}")


# Export main functions
__all__ = ['handle_import_request', 'handle_scheduled_import']