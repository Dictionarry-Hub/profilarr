# backend/app/middleware.py

from functools import wraps
from flask import request, session, jsonify, current_app
from .db import get_db
import logging

logger = logging.getLogger(__name__)


def init_middleware(app):
    """Initialize authentication middleware for the Flask app"""

    @app.before_request
    def authenticate_request():
        # Skip authentication for auth blueprint routes
        if request.blueprint == 'auth':
            return

        # Skip authentication for OPTIONS requests (CORS preflight)
        if request.method == 'OPTIONS':
            return

        # List of paths that don't require authentication
        PUBLIC_PATHS = ['/auth/setup', '/auth/authenticate']

        if request.path in PUBLIC_PATHS:
            return

        # Check session authentication (for web users)
        if session.get('authenticated'):
            db = get_db()
            user = db.execute('SELECT session_id FROM auth').fetchone()
            if user and session.get('session_id') == user['session_id']:
                return

        # Check API key authentication (for API users)
        api_key = request.headers.get('X-Api-Key')
        if api_key:
            db = get_db()
            try:
                user = db.execute('SELECT 1 FROM auth WHERE api_key = ?',
                                  (api_key, )).fetchone()
                if user:
                    return
                logger.warning(f'Invalid API key attempt: {api_key[:10]}...')
            except Exception as e:
                logger.error(f'Database error during API key check: {str(e)}')
                return jsonify({'error': 'Internal server error'}), 500

        # If no valid authentication is found, return 401
        logger.warning(f'Unauthorized access attempt to {request.path}')
        return jsonify({'error': 'Unauthorized'}), 401
