# backend/app/auth/__init__.py

from flask import Blueprint, jsonify, request, session
from werkzeug.security import generate_password_hash, check_password_hash
import secrets
import logging
from ..db import get_db

logger = logging.getLogger(__name__)
bp = Blueprint('auth', __name__, url_prefix='/auth')


@bp.route('/setup', methods=['GET', 'POST'])
def setup():
    db = get_db()

    # Handle GET request to check if setup is needed
    if request.method == 'GET':
        if db.execute('SELECT 1 FROM auth').fetchone():
            return jsonify({'error': 'Auth already configured'}), 400
        return jsonify({'needs_setup': True}), 200

    # Handle POST request for actual setup
    if db.execute('SELECT 1 FROM auth').fetchone():
        logger.warning('Failed setup attempt - auth already configured')
        return jsonify({'error': 'Auth already configured'}), 400

    data = request.get_json()
    username = data.get('username', 'admin')
    password = data.get('password')

    if not password:
        logger.error('Setup failed - no password provided')
        return jsonify({'error': 'Password is required'}), 400

    api_key = secrets.token_urlsafe(32)
    password_hash = generate_password_hash(password)
    session_id = secrets.token_urlsafe(32)  # Generate a new session ID

    try:
        db.execute(
            'INSERT INTO auth (username, password_hash, api_key, session_id) VALUES (?, ?, ?, ?)',
            (username, password_hash, api_key, session_id))
        db.commit()
        logger.info('Initial auth setup completed successfully')

        # Set up session after successful creation
        session['authenticated'] = True
        session['session_id'] = session_id
        session.permanent = True

        return jsonify({
            'message': 'Auth configured successfully',
            'username': username,
            'api_key': api_key,
            'authenticated': True
        })
    except Exception as e:
        logger.error(f'Setup failed - database error: {str(e)}')
        return jsonify({'error': 'Failed to setup authentication'}), 500


@bp.route('/authenticate', methods=['POST'])
def authenticate():
    db = get_db()
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    ip_address = request.remote_addr

    # Check recent failed attempts
    recent_attempts = db.execute(
        '''
        SELECT COUNT(*) as count FROM failed_attempts 
        WHERE ip_address = ? 
        AND attempt_time > datetime('now', '-15 minutes')
    ''', (ip_address, )).fetchone()['count']

    if recent_attempts >= 5:
        logger.warning(f'Too many failed attempts from IP: {ip_address}')
        return jsonify({'error':
                        'Too many failed attempts. Try again later.'}), 429

    if not username or not password:
        logger.warning('Authentication attempt with missing credentials')
        return jsonify({'error': 'Username and password required'}), 400

    user = db.execute('SELECT * FROM auth WHERE username = ?',
                      (username, )).fetchone()

    if user and check_password_hash(user['password_hash'], password):
        # Generate a new session ID
        new_session_id = secrets.token_urlsafe(32)
        db.execute('UPDATE auth SET session_id = ? WHERE username = ?',
                   (new_session_id, username))
        db.commit()

        # Set up session
        session['authenticated'] = True
        session[
            'session_id'] = new_session_id  # Store session ID in the session
        session.permanent = True

        # Clear failed attempts on success
        db.execute('DELETE FROM failed_attempts WHERE ip_address = ?',
                   (ip_address, ))
        db.commit()

        logger.info(f'Successful authentication for user: {username}')
        return jsonify({'authenticated': True})

    # Record failed attempt
    db.execute('INSERT INTO failed_attempts (ip_address) VALUES (?)',
               (ip_address, ))
    db.commit()

    logger.warning(f'Failed authentication attempt for user: {username}')
    return jsonify({'error': 'Invalid credentials'}), 401
