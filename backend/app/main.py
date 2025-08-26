# backend/app/main.py

from flask import Flask, jsonify, send_from_directory
import os
from flask_cors import CORS
from .config import config
from .git import bp as git_bp
from .arr import bp as arr_bp
from .data import bp as data_bp
from .importarr import bp as importarr_bp
from .importer.routes import bp as new_import_bp
from .task import bp as tasks_bp, TaskScheduler
from .backup import bp as backup_bp
from .db import run_migrations, get_settings
from .auth import bp as auth_bp
from .settings import bp as settings_bp
from .logs import bp as logs_bp
from .media_management import media_management_bp
from .middleware import init_middleware
from .init import setup_logging, init_app_config, init_git_user
from .data.cache import data_cache


def create_app():
    # Set up logging first
    logger = setup_logging()

    logger.info("Creating Flask application")
    app = Flask(__name__, static_folder='static')
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Serve static files
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_static(path):
        if path.startswith('api/'):
            return  # Let API routes handle these
        if path and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')

    # Initialize directories and database
    logger.info("Ensuring required directories exist")
    config.ensure_directories()

    logger.info("Initializing database")
    run_migrations()

    # Initialize Git user configuration
    logger.info("Initializing Git user")
    success, message = init_git_user()
    
    # Initialize data cache
    logger.info("Initializing data cache")
    data_cache.initialize()
    if not success:
        logger.warning(f"Git user initialization issue: {message}")
    else:
        logger.info("Git user initialized successfully")

    # Initialize app configuration
    init_app_config(app)

    # Initialize and start task scheduler
    logger.info("Starting task scheduler")
    scheduler = TaskScheduler()
    scheduler.load_tasks_from_db()
    scheduler.start()

    # Register all blueprints
    logger.info("Registering blueprints")
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    app.register_blueprint(backup_bp, url_prefix='/api/backup')
    app.register_blueprint(logs_bp, url_prefix='/api/logs')
    app.register_blueprint(git_bp, url_prefix='/api/git')
    app.register_blueprint(data_bp, url_prefix='/api/data')
    app.register_blueprint(importarr_bp, url_prefix='/api/import')
    app.register_blueprint(new_import_bp, url_prefix='/api/v2/import')
    app.register_blueprint(arr_bp, url_prefix='/api/arr')
    app.register_blueprint(tasks_bp, url_prefix='/api/tasks')
    app.register_blueprint(media_management_bp)

    # Initialize middleware
    logger.info("Initializing middleware")
    init_middleware(app)

    # Add settings route
    @app.route('/api/settings', methods=['GET'])
    def handle_settings():
        settings = get_settings()
        return jsonify(settings), 200

    logger.info("Flask application creation completed")
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0')
