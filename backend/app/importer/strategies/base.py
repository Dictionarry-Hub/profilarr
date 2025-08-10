"""Base strategy class for import operations."""
import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Any
from ..arr_handler import ArrHandler
from ..logger import get_import_logger

logger = logging.getLogger(__name__)


class ImportStrategy(ABC):
    """Base class for import strategies."""
    
    def __init__(self, arr_config):
        """
        Initialize the import strategy.
        
        Args:
            arr_config: Database row from arr_config table containing:
                - type: 'radarr' or 'sonarr'
                - arr_server: Base URL
                - api_key: API key
                - import_as_unique: Whether to add [Dictionarry] suffix
        """
        # Handle sqlite3.Row objects (they support dict-like access)
        self.arr_type = arr_config['type']
        self.base_url = arr_config['arr_server']
        self.api_key = arr_config['api_key']
        # sqlite3.Row doesn't have .get() method, so we need to handle None
        import_as_unique = arr_config['import_as_unique'] if 'import_as_unique' in arr_config.keys() else False
        self.import_as_unique = bool(import_as_unique) if import_as_unique is not None else False
        self.arr = ArrHandler(self.base_url, self.api_key)
    
    @abstractmethod
    def compile(self, filenames: List[str]) -> Dict[str, Any]:
        """
        Compile files to API-ready format.
        
        Args:
            filenames: List of filenames to compile
            
        Returns:
            Dictionary with compiled data
        """
        pass
    
    @abstractmethod
    def import_data(self, compiled_data: Dict[str, Any], dry_run: bool = False) -> Dict[str, Any]:
        """
        Import compiled data to Arr instance.
        
        Args:
            compiled_data: Data from compile() method
            dry_run: If True, simulate import without making changes
            
        Returns:
            Import results with added/updated/failed counts
        """
        pass
    
    def execute(self, filenames: List[str], dry_run: bool = False) -> Dict[str, Any]:
        """
        Execute the full import process.
        
        Args:
            filenames: List of filenames to import
            dry_run: If True, simulate import without making changes
            
        Returns:
            Import results
        """
        try:
            # Compile
            compiled = self.compile(filenames)
            
            # Import
            results = self.import_data(compiled, dry_run=dry_run)
            
            # Add dry_run flag and compiled data to results
            if dry_run:
                results['dry_run'] = True
                results['compiled_data'] = compiled
            
            return results
            
        except Exception as e:
            import_logger = get_import_logger()
            import_logger.error(f"Strategy execution failed: {e}", phase='import')
            return {
                'added': 0,
                'updated': 0,
                'failed': len(filenames),
                'error': str(e)
            }
        finally:
            # Clean up
            self.arr.close()
    
    def add_unique_suffix(self, name: str) -> str:
        """Add [Dictionarry] suffix if unique import is enabled."""
        if self.import_as_unique and not name.endswith('[Dictionarry]'):
            return f"{name} [Dictionarry]"
        return name