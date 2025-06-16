# backend/app/settings/__init__.py

from flask import Blueprint, jsonify, request, session
from werkzeug.security import generate_password_hash, check_password_hash
import secrets
from ..db import get_db
from ..db.queries.settings import get_language_import_score, update_language_import_score
import logging

logger = logging.getLogger(__name__)
bp = Blueprint('settings', __name__)


@bp.route('/general', methods=['GET'])
def get_general_settings():
    db = get_db()
    try:
        user = db.execute('SELECT username, api_key FROM auth').fetchone()
        if not user:
            logger.error('No user found in auth table')
            return jsonify({'error': 'No user configuration found'}), 500

        return jsonify({
            'username': user['username'],
            'api_key': user['api_key']
        })
    except Exception as e:
        logger.error(f'Error fetching general settings: {str(e)}')
        return jsonify({'error': 'Failed to fetch settings'}), 500


@bp.route('/username', methods=['PUT'])
def update_username():
    db = get_db()
    data = request.get_json()
    new_username = data.get('username')
    current_password = data.get('current_password')

    if not new_username or not current_password:
        return jsonify({'error':
                        'Username and current password are required'}), 400

    try:
        # Verify current password
        user = db.execute('SELECT password_hash FROM auth').fetchone()
        if not check_password_hash(user['password_hash'], current_password):
            logger.warning('Failed username change - invalid password')
            return jsonify({'error': 'Invalid password'}), 401

        db.execute('UPDATE auth SET username = ?', (new_username, ))
        db.commit()
        logger.info(f'Username updated to: {new_username}')

        return jsonify({'message': 'Username updated successfully'})
    except Exception as e:
        logger.error(f'Failed to update username: {str(e)}')
        return jsonify({'error': 'Failed to update username'}), 500


@bp.route('/password', methods=['PUT'])
def update_password():
    db = get_db()
    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')

    if not current_password or not new_password:
        return jsonify({'error':
                        'Current and new passwords are required'}), 400

    try:
        # Verify current password
        user = db.execute(
            'SELECT password_hash, session_id FROM auth').fetchone()
        if not check_password_hash(user['password_hash'], current_password):
            logger.warning('Failed password change - invalid current password')
            return jsonify({'error': 'Invalid current password'}), 401

        # Update password and generate a new session ID
        password_hash = generate_password_hash(new_password)
        new_session_id = secrets.token_urlsafe(32)
        db.execute('UPDATE auth SET password_hash = ?, session_id = ?',
                   (password_hash, new_session_id))
        db.commit()

        # Clear the current session to force re-login
        session.clear()

        logger.info('Password updated successfully')
        return jsonify({
            'message': 'Password updated successfully. Please log in again.',
            'requireRelogin': True
        })
    except Exception as e:
        logger.error(f'Failed to update password: {str(e)}')
        return jsonify({'error': 'Failed to update password'}), 500


@bp.route('/api-key', methods=['POST'])
def reset_api_key():
    db = get_db()
    data = request.get_json()
    current_password = data.get('current_password')

    if not current_password:
        return jsonify({'error': 'Current password is required'}), 400

    try:
        # Verify current password
        user = db.execute('SELECT password_hash FROM auth').fetchone()
        if not check_password_hash(user['password_hash'], current_password):
            logger.warning('Failed API key reset - invalid password')
            return jsonify({'error': 'Invalid password'}), 401

        # Generate and save new API key
        new_api_key = secrets.token_urlsafe(32)
        db.execute('UPDATE auth SET api_key = ?', (new_api_key, ))
        db.commit()

        logger.info('API key reset successfully')
        return jsonify({
            'message': 'API key reset successfully',
            'api_key': new_api_key
        })
    except Exception as e:
        logger.error(f'Failed to reset API key: {str(e)}')
        return jsonify({'error': 'Failed to reset API key'}), 500


@bp.route('/language-import-score', methods=['GET'])
def get_language_import_score_route():
    try:
        score = get_language_import_score()
        return jsonify({'score': score})
    except Exception as e:
        logger.error(f'Failed to get language import score: {str(e)}')
        return jsonify({'error': 'Failed to get language import score'}), 500


@bp.route('/language-import-score', methods=['PUT'])
def update_language_import_score_route():
    data = request.get_json()
    score = data.get('score')

    if score is None:
        return jsonify({'error': 'Score is required'}), 400

    try:
        score = int(score)
    except (ValueError, TypeError):
        return jsonify({'error': 'Score must be an integer'}), 400

    try:
        update_language_import_score(score)
        return jsonify({'message': 'Language import score updated successfully'})
    except Exception as e:
        logger.error(f'Failed to update language import score: {str(e)}')
        return jsonify({'error': 'Failed to update language import score'}), 500
