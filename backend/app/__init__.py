from flask import Flask
from flask_cors import CORS
from .regex import bp as regex_bp
from .format import bp as format_bp
from .settings import bp as settings_bp
from .profile import bp as profile_bp
import os

REGEX_DIR = os.path.join('data', 'db', 'regex_patterns')
FORMAT_DIR = os.path.join('data', 'db', 'custom_formats')
PROFILE_DIR = os.path.join('data', 'db', 'profiles')

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})
    
    # Initialize directories to avoid issues with non-existing directories
    initialize_directories()
    
    # Register Blueprints
    app.register_blueprint(regex_bp)
    app.register_blueprint(format_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(profile_bp)
   
    return app

def initialize_directories():
    os.makedirs(REGEX_DIR, exist_ok=True)
    os.makedirs(FORMAT_DIR, exist_ok=True)
    os.makedirs(PROFILE_DIR, exist_ok=True)