"""Custom logger for importer with progress tracking and colored output."""
import sys
from typing import List, Dict, Any
from datetime import datetime


class ImportLogger:
    """Custom logger with progress tracking and colored error output."""
    
    def __init__(self):
        """Initialize the import logger."""
        self.compilation_errors: List[Dict[str, str]] = []
        self.import_errors: List[Dict[str, str]] = []
        self.warnings: List[str] = []
        
        self.current_compilation = 0
        self.total_compilation = 0
        self.current_import = 0
        self.total_import = 0
        
        self.added = 0
        self.updated = 0
        self.failed = 0
        
        self.start_time = None
        self.compilation_items: List[str] = []
        self.import_items: List[Dict[str, str]] = []
        
    def _write_colored(self, text: str, color: str = None):
        """Write colored text to stderr."""
        if color == 'red':
            text = f"\033[91m{text}\033[0m"
        elif color == 'yellow':
            text = f"\033[93m{text}\033[0m"
        elif color == 'green':
            text = f"\033[92m{text}\033[0m"
        
        print(text, file=sys.stderr)
    
    def start(self, total_compilation: int, total_import: int):
        """Start the import process."""
        self.start_time = datetime.now()
        self.total_compilation = total_compilation
        self.total_import = total_import
        self.current_compilation = 0
        self.current_import = 0
    
    def update_compilation(self, item_name: str):
        """Track compilation progress."""
        self.current_compilation += 1
        self.compilation_items.append(item_name)
    
    def compilation_complete(self):
        """Show compilation summary."""
        if self.total_compilation > 0:
            print(f"Compiled: {self.current_compilation}/{self.total_compilation}", file=sys.stderr)
            
            # Show compilation errors if any
            if self.compilation_errors:
                for error in self.compilation_errors:
                    self._write_colored(f"ERROR: Failed to compile {error['item']}: {error['message']}", 'red')
    
    def update_import(self, item_name: str, action: str):
        """Track import progress."""
        self.import_items.append({'name': item_name, 'action': action})
        
        # Update counts based on action
        if action == 'added':
            self.added += 1
            self.current_import += 1  # Only count successful imports
        elif action == 'updated':
            self.updated += 1
            self.current_import += 1  # Only count successful imports
        elif action == 'failed':
            self.failed += 1
            # Don't increment current_import for failures
    
    def import_complete(self):
        """Show import summary."""
        if self.total_import > 0:
            print(f"Imported: {self.current_import}/{self.total_import}", file=sys.stderr)
            
            # Show import errors if any
            if self.import_errors:
                for error in self.import_errors:
                    self._write_colored(f"ERROR: {error['message']}", 'red')
            
            # Show warnings if any
            if self.warnings:
                for warning in self.warnings:
                    self._write_colored(f"WARNING: {warning}", 'yellow')
    
    def error(self, message: str, item_name: str = None, phase: str = 'import'):
        """Log an error."""
        if phase == 'compilation':
            self.compilation_errors.append({'item': item_name or 'unknown', 'message': message})
        else:
            self.import_errors.append({'item': item_name or 'unknown', 'message': message})
    
    def warning(self, message: str):
        """Log a warning."""
        self.warnings.append(message)
    
    def complete(self):
        """Complete the import and show final summary."""
        # Show import summary first if not already shown
        if self.current_import > 0 and not hasattr(self, '_import_shown'):
            self.import_complete()
        
        # Calculate duration
        if self.start_time:
            duration = (datetime.now() - self.start_time).total_seconds()
            duration_str = f"{duration:.1f}s"
        else:
            duration_str = "N/A"
        
        # Simple final summary
        print(f"\n{'='*50}", file=sys.stderr)
        print(f"Import Complete in {duration_str}", file=sys.stderr)
        print(f"Added: {self.added}, Updated: {self.updated}, Failed: {self.failed}", file=sys.stderr)
        print(f"{'='*50}\n", file=sys.stderr)


# Global instance
_logger = None

def get_import_logger() -> ImportLogger:
    """Get the import logger instance."""
    global _logger
    if _logger is None:
        _logger = ImportLogger()
    return _logger

def reset_import_logger() -> ImportLogger:
    """Reset and return a new import logger."""
    global _logger
    _logger = ImportLogger()
    return _logger