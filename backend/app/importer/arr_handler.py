"""ArrHandler class - manages all Arr API communication."""
import logging
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


class ArrApiError(Exception):
    """Custom exception for Arr API errors."""
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class ArrHandler:
    """Manages all communication with Radarr/Sonarr API."""
    
    def __init__(self, base_url: str, api_key: str):
        """
        Initialize the Arr API handler.
        
        Args:
            base_url: Base URL of the Arr instance
            api_key: API key for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.headers = {
            'X-Api-Key': api_key,
            'Content-Type': 'application/json'
        }
        self.session = self._create_session()
    
    def _create_session(self) -> requests.Session:
        """Create a session with connection pooling and retry logic."""
        session = requests.Session()
        
        # Configure retry strategy
        retry = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[500, 502, 503, 504]
        )
        
        # Configure connection pooling
        adapter = HTTPAdapter(
            pool_connections=5,
            pool_maxsize=5,
            max_retries=retry
        )
        
        session.mount('http://', adapter)
        session.mount('https://', adapter)
        session.headers.update(self.headers)
        
        return session
    
    def get(self, endpoint: str) -> Any:
        """
        Make a GET request to the Arr API.
        
        Args:
            endpoint: API endpoint path
            
        Returns:
            JSON response data
            
        Raises:
            ArrApiError: If request fails
        """
        url = f"{self.base_url}{endpoint}"
        try:
            response = self.session.get(url, timeout=30)
            if response.status_code != 200:
                raise ArrApiError(
                    f"GET {endpoint} failed: {response.text}",
                    response.status_code
                )
            return response.json()
        except requests.RequestException as e:
            raise ArrApiError(f"GET {endpoint} failed: {str(e)}")
    
    def post(self, endpoint: str, data: Dict[str, Any]) -> Any:
        """
        Make a POST request to the Arr API.
        
        Args:
            endpoint: API endpoint path
            data: JSON data to send
            
        Returns:
            JSON response data
            
        Raises:
            ArrApiError: If request fails
        """
        url = f"{self.base_url}{endpoint}"
        try:
            response = self.session.post(url, json=data, timeout=30)
            if response.status_code not in [200, 201]:
                raise ArrApiError(
                    f"POST {endpoint} failed: {response.text}",
                    response.status_code
                )
            return response.json()
        except requests.RequestException as e:
            raise ArrApiError(f"POST {endpoint} failed: {str(e)}")
    
    def put(self, endpoint: str, data: Dict[str, Any]) -> Any:
        """
        Make a PUT request to the Arr API.
        
        Args:
            endpoint: API endpoint path
            data: JSON data to send
            
        Returns:
            JSON response data (if any)
            
        Raises:
            ArrApiError: If request fails
        """
        url = f"{self.base_url}{endpoint}"
        try:
            response = self.session.put(url, json=data, timeout=30)
            if response.status_code not in [200, 202, 204]:
                raise ArrApiError(
                    f"PUT {endpoint} failed: {response.text}",
                    response.status_code
                )
            # 204 No Content won't have JSON
            if response.status_code == 204:
                return {}
            return response.json()
        except requests.RequestException as e:
            raise ArrApiError(f"PUT {endpoint} failed: {str(e)}")
    
    def get_all_formats(self) -> List[Dict[str, Any]]:
        """Get all custom formats from the Arr instance."""
        return self.get("/api/v3/customformat")
    
    def get_all_profiles(self) -> List[Dict[str, Any]]:
        """Get all quality profiles from the Arr instance."""
        return self.get("/api/v3/qualityprofile")
    
    def close(self):
        """Close the session."""
        self.session.close()