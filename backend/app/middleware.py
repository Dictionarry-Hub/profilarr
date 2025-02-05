# backend/app/middleware.py

from flask import request, session, jsonify, send_from_directory
from .db import get_db
import logging

logger = logging.getLogger(__name__)


def init_middleware(app):
    """Initialize authentication middleware for the Flask app"""

    @app.before_request
    def authenticate_request():
        # Skip authentication for OPTIONS requests (CORS preflight)
        if request.method == 'OPTIONS':
            return

        # Always allow auth endpoints
        if request.path.startswith('/api/auth/'):
            return

        # Allow static assets needed for auth pages
        if request.path.startswith(
            ('/assets/',
             '/static/')) or request.path in ['/', '/regex.svg', '/clone.svg']:
            return

        # For API routes, require auth
        if request.path.startswith('/api/'):
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
                    logger.warning(
                        f'Invalid API key attempt: {api_key[:10]}...')
                except Exception as e:
                    logger.error(
                        f'Database error during API key check: {str(e)}')
                    return jsonify({'error': 'Internal server error'}), 500

            # If no valid authentication is found, return 401
            logger.warning(f'Unauthorized access attempt to {request.path}')
            return jsonify({'error': 'Unauthorized'}), 401

        # For all other routes (frontend routes), serve index.html
        # This lets React handle auth and routing
        return send_from_directory(app.static_folder, 'index.html')
