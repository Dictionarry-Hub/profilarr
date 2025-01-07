from flask import Blueprint, jsonify, request, send_file
import os
from ..config import config
import logging

bp = Blueprint('logs', __name__, url_prefix='/logs')
logger = logging.getLogger(__name__)


@bp.route('/', methods=['GET'])
def get_logs():
    """Get list of available log files."""
    try:
        log_dir = os.path.dirname(config.GENERAL_LOG_FILE)
        log_files = []

        # Get all log files including rotated ones
        for filename in os.listdir(log_dir):
            if filename.endswith('.log') or filename.endswith('.log.1'):
                file_path = os.path.join(log_dir, filename)
                file_stat = os.stat(file_path)
                log_files.append({
                    'filename': filename,
                    'size': file_stat.st_size,
                    'last_modified': file_stat.st_mtime
                })

        return jsonify(log_files), 200
    except Exception as e:
        logger.error(f"Error getting log files: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/<filename>', methods=['GET'])
def get_log_content(filename):
    """Get content of a specific log file."""
    try:
        log_dir = os.path.dirname(config.GENERAL_LOG_FILE)
        file_path = os.path.join(log_dir, filename)

        # Ensure the file exists and is within the log directory
        if not os.path.exists(file_path) or not file_path.startswith(log_dir):
            return jsonify({'error': 'Log file not found'}), 404

        # Get query parameters for filtering
        lines = request.args.get('lines',
                                 type=int)  # Number of lines to return
        level = request.args.get('level')  # Log level filter
        search = request.args.get('search')  # Search term

        # If no filters, return the whole file
        if not any([lines, level, search]):
            return send_file(file_path, mimetype='text/plain')

        # Read and filter log content
        with open(file_path, 'r') as f:
            content = f.readlines()

        # Apply filters
        filtered_content = content

        if level:
            filtered_content = [
                line for line in filtered_content
                if f' - {level.upper()} - ' in line
            ]

        if search:
            filtered_content = [
                line for line in filtered_content
                if search.lower() in line.lower()
            ]

        if lines:
            filtered_content = filtered_content[-lines:]

        return jsonify({
            'filename': filename,
            'total_lines': len(content),
            'filtered_lines': len(filtered_content),
            'content': filtered_content
        }), 200

    except Exception as e:
        logger.error(f"Error reading log file {filename}: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/level/<level>', methods=['GET'])
def get_logs_by_level(level):
    """Get all logs of a specific level."""
    try:
        log_dir = os.path.dirname(config.GENERAL_LOG_FILE)
        results = []

        for filename in os.listdir(log_dir):
            if filename.endswith('.log'):
                file_path = os.path.join(log_dir, filename)
                with open(file_path, 'r') as f:
                    matching_lines = [
                        line.strip() for line in f
                        if f' - {level.upper()} - ' in line
                    ]
                    if matching_lines:
                        results.extend(matching_lines)

        return jsonify({
            'level': level.upper(),
            'count': len(results),
            'logs': results
        }), 200

    except Exception as e:
        logger.error(f"Error getting logs for level {level}: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bp.route('/search', methods=['GET'])
def search_logs():
    """Search all logs for a specific term."""
    try:
        term = request.args.get('q')
        if not term:
            return jsonify({'error': 'Search term required'}), 400

        log_dir = os.path.dirname(config.GENERAL_LOG_FILE)
        results = []

        for filename in os.listdir(log_dir):
            if filename.endswith('.log'):
                file_path = os.path.join(log_dir, filename)
                with open(file_path, 'r') as f:
                    matching_lines = [
                        line.strip() for line in f
                        if term.lower() in line.lower()
                    ]
                    if matching_lines:
                        results.extend(matching_lines)

        return jsonify({
            'term': term,
            'count': len(results),
            'logs': results
        }), 200

    except Exception as e:
        logger.error(f"Error searching logs: {str(e)}")
        return jsonify({'error': str(e)}), 500
