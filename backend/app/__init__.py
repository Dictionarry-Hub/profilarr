import os
from flask import Flask, jsonify
from flask_cors import CORS
from .regex import bp as regex_bp
from .format import bp as format_bp
from .profile import bp as profile_bp
from .git import bp as git_bp
from .arr import bp as arr_bp
from .data import bp as data_bp
from .settings_utils import create_empty_settings_if_not_exists, load_settings
from .db import init_db
import logging

REGEX_DIR = os.path.join('data', 'db', 'regex_patterns')
FORMAT_DIR = os.path.join('data', 'db', 'custom_formats')
PROFILE_DIR = os.path.join('data', 'db', 'profiles')
DATA_DIR = '/app/data'


def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Set up logging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

    # Initialize directories and create empty settings file if it doesn't exist
    initialize_directories()
    create_empty_settings_if_not_exists()

    init_db()

    # Register Blueprints
    app.register_blueprint(regex_bp)
    app.register_blueprint(format_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(git_bp)
    app.register_blueprint(data_bp)
    app.register_blueprint(arr_bp)

    # Add settings route
    @app.route('/settings', methods=['GET'])
    def handle_settings():
        settings = load_settings()
        return jsonify(settings), 200

    return app


def initialize_directories():
    os.makedirs(REGEX_DIR, exist_ok=True)
    os.makedirs(FORMAT_DIR, exist_ok=True)
    os.makedirs(PROFILE_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
