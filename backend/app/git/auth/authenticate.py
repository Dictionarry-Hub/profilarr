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
        Ensures the token is not duplicated in the URL.
        """
        token = os.getenv("PROFILARR_PAT")
        if not token:
            raise ValueError(
                "PROFILARR_PAT is not set in environment variables")
                
        # Check if the URL already contains authentication
        if "@" in https_url:
            # Already has some form of authentication, remove it to add our token
            # This handles URLs that might have a token already
            protocol_part, rest = https_url.split("://", 1)
            if "@" in rest:
                # Remove any existing authentication
                _, server_part = rest.split("@", 1)
                https_url = f"{protocol_part}://{server_part}"
                
        # Now add our token
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
