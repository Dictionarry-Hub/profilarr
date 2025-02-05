# app/backup/__init__.py
from flask import Blueprint, request, jsonify, send_file
import logging
from ..task.backup.backup import BackupManager
from ..db import get_db
import os
from datetime import datetime
import tempfile
import zipfile

logger = logging.getLogger(__name__)
bp = Blueprint('backup', __name__)


@bp.route('', methods=['GET'])
def list_backups():
    """Get list of all backups"""
    try:
        manager = BackupManager()
        backups = manager.list_backups()

        # Add file size and last modified time to each backup
        for backup in backups:
            file_path = os.path.join(manager.backup_dir, backup['filename'])
            if os.path.exists(file_path):
                backup['size'] = os.path.getsize(file_path)
                backup['created_at'] = datetime.fromtimestamp(
                    os.path.getmtime(file_path)).isoformat()
            else:
                backup['size'] = None
                backup['created_at'] = None

        return jsonify(backups), 200
    except Exception as e:
        logger.error(f'Error listing backups: {str(e)}')
        return jsonify({'error': 'Failed to list backups'}), 500


@bp.route('', methods=['POST'])
def create_backup():
    """Create a new backup manually"""
    try:
        manager = BackupManager()
        success, result = manager.create_backup()

        if success:
            return jsonify({
                'message': 'Backup created successfully',
                'filename': result
            }), 201
        else:
            return jsonify({'error':
                            f'Failed to create backup: {result}'}), 500
    except Exception as e:
        logger.error(f'Error creating backup: {str(e)}')
        return jsonify({'error': 'Failed to create backup'}), 500


@bp.route('/<path:filename>', methods=['GET'])
def download_backup(filename):
    """Download a specific backup file"""
    try:
        manager = BackupManager()
        file_path = os.path.join(manager.backup_dir, filename)

        if not os.path.exists(file_path):
            return jsonify({'error': 'Backup file not found'}), 404

        return send_file(file_path,
                         mimetype='application/zip',
                         as_attachment=True,
                         download_name=filename)
    except Exception as e:
        logger.error(f'Error downloading backup: {str(e)}')
        return jsonify({'error': 'Failed to download backup'}), 500


@bp.route('/<path:filename>/restore', methods=['POST'])
def restore_backup(filename):
    """Restore from a specific backup"""
    try:
        manager = BackupManager()
        success, message = manager.restore_backup(filename)

        if success:
            return jsonify({'message': 'Backup restored successfully'}), 200
        else:
            return jsonify({'error':
                            f'Failed to restore backup: {message}'}), 500
    except Exception as e:
        logger.error(f'Error restoring backup: {str(e)}')
        return jsonify({'error': 'Failed to restore backup'}), 500


@bp.route('/<path:filename>', methods=['DELETE'])
def delete_backup(filename):
    """Delete a specific backup"""
    try:
        manager = BackupManager()
        file_path = os.path.join(manager.backup_dir, filename)

        if not os.path.exists(file_path):
            return jsonify({'error': 'Backup file not found'}), 404

        # Remove the file
        os.remove(file_path)

        # Remove from database
        with get_db() as conn:
            conn.execute('DELETE FROM backups WHERE filename = ?',
                         (filename, ))
            conn.commit()

        return jsonify({'message': 'Backup deleted successfully'}), 200
    except Exception as e:
        logger.error(f'Error deleting backup: {str(e)}')
        return jsonify({'error': 'Failed to delete backup'}), 500


@bp.route('/import', methods=['POST'])
def import_backup():
    """Import and restore from an uploaded backup file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No file selected for uploading'}), 400

    if not file.filename.endswith('.zip'):
        return jsonify({'error': 'File must be a zip archive'}), 400

    try:
        # Create a temporary file to store the upload
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            file.save(temp_file.name)

        # Validate the zip file
        validation_result = is_valid_backup_zip(temp_file.name)
        if not validation_result[0]:
            os.unlink(temp_file.name)
            return jsonify({'error': validation_result[1]}), 400

        # Use the BackupManager to restore from this file
        manager = BackupManager()
        success, message = manager.restore_backup_from_file(temp_file.name)

        # Delete the temporary file
        os.unlink(temp_file.name)

        if success:
            return jsonify(
                {'message': 'Backup imported and restored successfully'}), 200
        else:
            return jsonify(
                {'error':
                 f'Failed to import and restore backup: {message}'}), 500

    except Exception as e:
        logger.error(f'Error importing and restoring backup: {str(e)}')
        return jsonify({'error': 'Failed to import and restore backup'}), 500


def is_valid_backup_zip(file_path):
    """Check if the zip file is a valid backup"""
    try:
        if os.path.getsize(file_path) > 100 * 1024 * 1024:  # 100 MB
            return False, "Backup file is too large (max 100 MB)"

        with zipfile.ZipFile(file_path, 'r') as zipf:
            file_list = zipf.namelist()

            if 'profilarr.db' not in file_list:
                return False, "Backup file does not contain profilarr.db"

            return True, "Valid backup file"
    except zipfile.BadZipFile:
        return False, "Invalid zip file"
