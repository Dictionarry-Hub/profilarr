from flask import Flask, jsonify
from flask_cors import CORS
from .config import config
from .git import bp as git_bp
from .arr import bp as arr_bp
from .data import bp as data_bp
from .importarr import bp as importarr_bp
from .task import bp as tasks_bp, TaskScheduler
from .backup import bp as backup_bp
from .db import run_migrations, get_settings
from .auth import bp as auth_bp
from .logs import bp as logs_bp
from .middleware import init_middleware
from .init import setup_logging, init_app_config, init_git_user


def create_app():
    # Set up logging first
    logger = setup_logging()

    logger.info("Creating Flask application")
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Initialize directories and database
    logger.info("Ensuring required directories exist")
    config.ensure_directories()

    logger.info("Initializing database")
    run_migrations()

    # Initialize Git user configuration
    logger.info("Initializing Git user")
    success, message = init_git_user()
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
    app.register_blueprint(auth_bp)
    app.register_blueprint(backup_bp)
    app.register_blueprint(logs_bp)
    app.register_blueprint(git_bp)
    app.register_blueprint(data_bp)
    app.register_blueprint(importarr_bp)
    app.register_blueprint(arr_bp)
    app.register_blueprint(tasks_bp)

    # Initialize middleware
    logger.info("Initializing middleware")
    init_middleware(app)

    # Add settings route
    @app.route('/settings', methods=['GET'])
    def handle_settings():
        settings = get_settings()
        return jsonify(settings), 200

    logger.info("Flask application creation completed")
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0')
