# app/task/backup/backup.py
import os
import shutil
from datetime import datetime, timedelta
import logging
from pathlib import Path
import zipfile
import tempfile
from ...config.config import config
from ...db import get_db

logger = logging.getLogger(__name__)


class BackupManager:

    def __init__(self):
        self.backup_dir = os.path.join(config.CONFIG_DIR, 'backups')
        self.retention_days = 30
        self._ensure_backup_directory()

    def _ensure_backup_directory(self):
        """Ensure backup directory exists"""
        os.makedirs(self.backup_dir, exist_ok=True)

    def create_backup(self):
        """Create a new backup of the config directory"""
        try:
            # Generate backup filename with timestamp
            timestamp = datetime.now().strftime('%Y_%m_%d_%H%M%S')
            backup_filename = f'backup_{timestamp}.zip'
            backup_path = os.path.join(self.backup_dir, backup_filename)

            # Create zip file
            with zipfile.ZipFile(backup_path, 'w',
                                 zipfile.ZIP_DEFLATED) as zipf:
                # Walk through all files in config directory
                for root, dirs, files in os.walk(config.CONFIG_DIR):
                    # Skip the backups directory itself
                    if 'backups' in root:
                        continue

                    for file in files:
                        file_path = os.path.join(root, file)
                        # Calculate path relative to config directory
                        arc_path = os.path.relpath(file_path,
                                                   config.CONFIG_DIR)
                        zipf.write(file_path, arc_path)

            # Record backup in database
            with get_db() as conn:
                conn.execute(
                    '''
                    INSERT INTO backups (filename, created_at, status)
                    VALUES (?, CURRENT_TIMESTAMP, 'completed')
                ''', (backup_filename, ))
                conn.commit()

            logger.info(f'Backup created successfully: {backup_filename}')
            return True, backup_filename

        except Exception as e:
            logger.error(f'Error creating backup: {str(e)}')
            return False, str(e)

    def restore_backup(self, backup_filename):
        """Restore from a backup file"""
        backup_path = os.path.join(self.backup_dir, backup_filename)

        if not os.path.exists(backup_path):
            return False, "Backup file not found"

        try:
            # Create a temporary directory for extraction
            temp_dir = os.path.join(self.backup_dir, 'temp_restore')
            os.makedirs(temp_dir, exist_ok=True)

            # Extract backup to temporary directory
            with zipfile.ZipFile(backup_path, 'r') as zipf:
                zipf.extractall(temp_dir)

            # Move files to config directory
            for item in os.listdir(temp_dir):
                s = os.path.join(temp_dir, item)
                d = os.path.join(config.CONFIG_DIR, item)

                if os.path.isdir(s):
                    # Skip backups directory if it exists in the backup
                    if item == 'backups':
                        continue
                    shutil.rmtree(d, ignore_errors=True)
                    shutil.copytree(s, d, dirs_exist_ok=True)
                else:
                    shutil.copy2(s, d)

            # Clean up temporary directory
            shutil.rmtree(temp_dir)

            logger.info(f'Backup restored successfully: {backup_filename}')
            return True, "Backup restored successfully"

        except Exception as e:
            logger.error(f'Error restoring backup: {str(e)}')
            return False, str(e)

    def cleanup_old_backups(self):
        """Remove backups older than retention period"""
        try:
            cutoff_date = datetime.now() - timedelta(days=self.retention_days)

            with get_db() as conn:
                # Get list of old backups
                old_backups = conn.execute(
                    '''
                    SELECT filename FROM backups 
                    WHERE created_at < ?
                ''', (cutoff_date.isoformat(), )).fetchall()

                # Remove old backup files and database entries
                for backup in old_backups:
                    backup_path = os.path.join(self.backup_dir,
                                               backup['filename'])
                    if os.path.exists(backup_path):
                        os.remove(backup_path)

                    conn.execute('DELETE FROM backups WHERE filename = ?',
                                 (backup['filename'], ))

                conn.commit()

            logger.info('Old backups cleaned up successfully')
            return True, "Cleanup completed successfully"

        except Exception as e:
            logger.error(f'Error cleaning up old backups: {str(e)}')
            return False, str(e)

    def list_backups(self):
        """List all available backups"""
        try:
            with get_db() as conn:
                backups = conn.execute('''
                    SELECT filename, created_at, status
                    FROM backups
                    ORDER BY created_at DESC
                ''').fetchall()

                return [{
                    'filename': backup['filename'],
                    'created_at': backup['created_at'],
                    'status': backup['status']
                } for backup in backups]

        except Exception as e:
            logger.error(f'Error listing backups: {str(e)}')
            return []

    def restore_backup_from_file(self, file_path):
        """Restore from a backup file path"""
        try:
            # Create a temporary directory for extraction
            with tempfile.TemporaryDirectory() as temp_dir:
                # Extract backup to temporary directory
                with zipfile.ZipFile(file_path, 'r') as zipf:
                    zipf.extractall(temp_dir)

                # Move files to config directory
                for item in os.listdir(temp_dir):
                    s = os.path.join(temp_dir, item)
                    d = os.path.join(config.CONFIG_DIR, item)

                    if os.path.isdir(s):
                        # Skip backups directory if it exists in the backup
                        if item == 'backups':
                            continue
                        shutil.rmtree(d, ignore_errors=True)
                        shutil.copytree(s, d, dirs_exist_ok=True)
                    else:
                        shutil.copy2(s, d)

            logger.info(f'Backup imported and restored successfully')
            return True, "Backup imported and restored successfully"

        except Exception as e:
            logger.error(f'Error importing and restoring backup: {str(e)}')
            return False, str(e)
