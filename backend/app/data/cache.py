import os
import yaml
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import threading
from .utils import get_category_directory, get_file_modified_date, filename_to_display

logger = logging.getLogger(__name__)

class DataCache:
    """In-memory cache for YAML data"""
    
    def __init__(self):
        self._cache = {
            'regex_pattern': {},
            'custom_format': {},
            'profile': {}
        }
        self._lock = threading.RLock()
        self._initialized = False
    
    def initialize(self, force_reload=False):
        """Load all data into memory on startup
        
        Args:
            force_reload: If True, force a reload even if already initialized
        """
        with self._lock:
            if self._initialized and not force_reload:
                return
            
            logger.info("Initializing data cache..." if not force_reload else "Reloading data cache...")
            for category in self._cache.keys():
                self._load_category(category)
            
            self._initialized = True
            logger.info("Data cache initialized successfully" if not force_reload else "Data cache reloaded successfully")
    
    def _load_category(self, category: str):
        """Load all items from a category into cache"""
        try:
            directory = get_category_directory(category)
            items = {}
            
            for filename in os.listdir(directory):
                if not filename.endswith('.yml'):
                    continue
                
                file_path = os.path.join(directory, filename)
                try:
                    with open(file_path, 'r') as f:
                        content = yaml.safe_load(f)
                        if content:
                            # Store with metadata
                            items[filename] = {
                                'file_name': filename,
                                'modified_date': get_file_modified_date(file_path),
                                'content': content
                            }
                except Exception as e:
                    logger.error(f"Error loading {file_path}: {e}")
            
            self._cache[category] = items
            logger.info(f"Loaded {len(items)} items for category {category}")
            
        except Exception as e:
            logger.error(f"Error loading category {category}: {e}")
    
    def get_all(self, category: str) -> List[Dict[str, Any]]:
        """Get all items from a category"""
        with self._lock:
            if not self._initialized:
                self.initialize()
            
            return list(self._cache.get(category, {}).values())
    
    def get_item(self, category: str, name: str) -> Optional[Dict[str, Any]]:
        """Get a specific item"""
        with self._lock:
            if not self._initialized:
                self.initialize()
            
            # Convert name to filename
            filename = f"{name.replace('[', '(').replace(']', ')')}.yml"
            return self._cache.get(category, {}).get(filename)
    
    def update_item(self, category: str, filename: str, content: Dict[str, Any]):
        """Update an item in cache"""
        with self._lock:
            if category in self._cache:
                file_path = os.path.join(get_category_directory(category), filename)
                self._cache[category][filename] = {
                    'file_name': filename,
                    'modified_date': get_file_modified_date(file_path),
                    'content': content
                }
                logger.debug(f"Updated cache for {category}/{filename}")
    
    def remove_item(self, category: str, filename: str):
        """Remove an item from cache"""
        with self._lock:
            if category in self._cache and filename in self._cache[category]:
                del self._cache[category][filename]
                logger.debug(f"Removed from cache: {category}/{filename}")
    
    def rename_item(self, category: str, old_filename: str, new_filename: str):
        """Rename an item in cache"""
        with self._lock:
            if category in self._cache and old_filename in self._cache[category]:
                item = self._cache[category].pop(old_filename)
                item['file_name'] = new_filename
                self._cache[category][new_filename] = item
                logger.debug(f"Renamed in cache: {category}/{old_filename} -> {new_filename}")

# Global cache instance
data_cache = DataCache()