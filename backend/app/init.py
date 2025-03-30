from datetime import timedelta
import os
import subprocess
import logging
import logging.config
from .config import config
from .db import get_secret_key, update_pat_status


def setup_logging():
    log_config = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'detailed': {
                'format':
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                'datefmt': '%Y-%m-%d %H:%M:%S'
            }
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'level': 'DEBUG',
                'formatter': 'detailed',
                'stream': 'ext://sys.stdout'
            },

            # general_file handler
            'file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'level': 'INFO',
                'formatter': 'detailed',
                'filename': config.GENERAL_LOG_FILE,
                'maxBytes': 1048576,  # 1MB
                'backupCount': 20
            },

            # importarr_file handler
            'importarr_file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'level': 'DEBUG',
                'formatter': 'detailed',
                'filename': config.IMPORTARR_LOG_FILE,
                'maxBytes': 1048576,
                'backupCount': 20
            },

            # hash_file handler
            'hash_file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'level': 'INFO',
                'formatter': 'detailed',
                'filename': config.HASH_LOG_FILE,
                'maxBytes': 1048576,  # 1MB
                'backupCount': 20
            }
        },
        'root': {
            'level': 'DEBUG',
            'handlers': ['console', 'file']
        },
        'loggers': {
            # The 'importarr' logger uses all three handlers
            'importarr': {
                'level': 'DEBUG',
                'handlers': ['console', 'file', 'importarr_file'],
                'propagate': False
            },

            # The 'hash' logger uses all three handlers
            'hash': {
                'level': 'INFO',
                'handlers': ['console', 'file', 'hash_file'],
                'propagate': False
            },

            # Example: Keep these if you want separate loggers
            'werkzeug': {
                'level': 'INFO',
                'handlers': ['console', 'file'],
                'propagate': False
            },
            'flask': {
                'level': 'INFO',
                'handlers': ['console', 'file'],
                'propagate': False
            },
            'git': {
                'level': 'ERROR',
                'handlers': ['console', 'file'],
                'propagate': False
            }
        }
    }

    # Make sure the log directory exists
    os.makedirs(os.path.dirname(config.GENERAL_LOG_FILE), exist_ok=True)

    # Apply the configuration
    logging.config.dictConfig(log_config)

    # Create a logger for this module
    logger = logging.getLogger(__name__)
    logger.info("Logging system initialized")

    return logger


def init_git_user():
    """Initialize Git user configuration globally and update PAT status."""
    logger = logging.getLogger(__name__)
    logger.info("Starting Git user configuration")

    try:
        git_name = os.environ.get('GIT_USER_NAME', 'Profilarr')
        git_email = os.environ.get('GIT_USER_EMAIL',
                                   'profilarr@dictionarry.com')

        logger.debug(
            f"Retrieved Git config - Name: {git_name}, Email: {git_email}")

        if git_name == 'Profilarr' or git_email == 'profilarr@dictionarry.com':
            logger.info("Using default Git user configuration")

        # Set global Git configuration
        subprocess.run(['git', 'config', '--global', 'user.name', git_name],
                       check=True)
        subprocess.run(['git', 'config', '--global', 'user.email', git_email],
                       check=True)

        # Update PAT status in database
        update_pat_status()

        # Verify configuration
        configured_name = subprocess.run(
            ['git', 'config', '--global', 'user.name'],
            capture_output=True,
            text=True,
            check=True).stdout.strip()
        configured_email = subprocess.run(
            ['git', 'config', '--global', 'user.email'],
            capture_output=True,
            text=True,
            check=True).stdout.strip()

        if configured_name != git_name or configured_email != git_email:
            logger.error("Git configuration verification failed")
            return False, "Git configuration verification failed"

        logger.info("Git user configuration completed successfully")
        return True, "Git configuration successful"

    except subprocess.CalledProcessError as e:
        logger.error(f"Error configuring git: {str(e)}", exc_info=True)
        return False, f"Failed to configure git: {str(e)}"
    except Exception as e:
        logger.error(f"Unexpected error configuring git: {str(e)}",
                     exc_info=True)
        return False, f"Unexpected error configuring git: {str(e)}"


def init_app_config(app):
    """Initialize Flask app configuration."""
    logger = logging.getLogger(__name__)

    logger.info("Initializing app configuration")
    app.config['SECRET_KEY'] = get_secret_key()
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(
        days=config.SESSION_LIFETIME_DAYS)
    app.config['SESSION_COOKIE_SECURE'] = config.SESSION_COOKIE_SECURE
    app.config['SESSION_COOKIE_HTTPONLY'] = config.SESSION_COOKIE_HTTPONLY
    app.config['SESSION_COOKIE_SAMESITE'] = config.SESSION_COOKIE_SAMESITE

    logger.info("App configuration initialized")
