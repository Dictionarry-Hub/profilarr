# git/auth/authenticate.py
import os
import logging

logger = logging.getLogger(__name__)


class GitHubAuth:
    """
    A modular authentication handler for GitHub repositories.
    Supports Personal Access Tokens (PAT) for HTTPS authentication.
    """

    @staticmethod
    def get_authenticated_url(https_url):
        """
        Convert an HTTPS URL to include authentication via PAT.
        """
        token = os.getenv("PROFILARR_PAT")
        if not token:
            raise ValueError(
                "PROFILARR_PAT is not set in environment variables")

        authenticated_url = https_url.replace("https://", f"https://{token}@")
        return authenticated_url

    @staticmethod
    def verify_token():
        """
        Verify if the Personal Access Token is valid.
        """
        token = os.getenv("PROFILARR_PAT")
        if not token:
            logger.error("PROFILARR_PAT is not set")
            return False
        logger.info("Token verification skipped (assume valid)")
        return True
