import os
import logging


class Config:
    # Base Paths
    CONFIG_DIR = os.getenv('CONFIG_DIR', '/config')
    DB_PATH = os.path.join(CONFIG_DIR, 'profilarr.db')
    DB_DIR = os.path.join(CONFIG_DIR, 'db')

    REGEX_DIR = os.path.join(DB_DIR, 'regex_patterns')
    FORMAT_DIR = os.path.join(DB_DIR, 'custom_formats')
    PROFILE_DIR = os.path.join(DB_DIR, 'profiles')
    MEDIA_MANAGEMENT_DIR = os.path.join(DB_DIR, 'media_management')

    # Logging
    LOG_DIR = os.path.join(CONFIG_DIR, 'log')
    GENERAL_LOG_FILE = os.path.join(LOG_DIR, 'profilarr.log')
    IMPORTARR_LOG_FILE = os.path.join(LOG_DIR, 'importarr.log')
    HASH_LOG_FILE = os.path.join(LOG_DIR, 'hash.log')

    # Flask Configuration
    FLASK_ENV = os.getenv('FLASK_ENV', 'production')
    DEBUG = FLASK_ENV == 'development'

    # CORS Configuration
    CORS_ORIGINS = "*"

    # Session Configuration
    SESSION_LIFETIME_DAYS = 30
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # Git Configuration
    GIT_USER_NAME = os.getenv('GIT_USER_NAME')
    GIT_USER_EMAIL = os.getenv('GIT_USER_EMAIL')

    @staticmethod
    def ensure_directories():
        """Create all required directories if they don't exist."""
        directories = [
            Config.CONFIG_DIR, Config.DB_DIR, Config.REGEX_DIR,
            Config.FORMAT_DIR, Config.PROFILE_DIR, Config.MEDIA_MANAGEMENT_DIR, Config.LOG_DIR
        ]
        logger = logging.getLogger(__name__)
        for directory in directories:
            try:
                os.makedirs(directory, exist_ok=True)
                logger.info(f"Ensured directory exists: {directory}")
            except Exception as e:
                logger.error(
                    f"Failed to create directory {directory}: {str(e)}")


config = Config()
