"""Format import strategy."""
import logging
from typing import Dict, List, Any
from .base import ImportStrategy
from ..utils import load_yaml
from ..compiler import compile_format_to_api_structure
from ..logger import get_import_logger

logger = logging.getLogger(__name__)


class FormatStrategy(ImportStrategy):
    """Strategy for importing custom formats."""
    
    def compile(self, filenames: List[str]) -> Dict[str, Any]:
        """
        Compile format files to API-ready format.
        
        Args:
            filenames: List of format filenames (without .yml)
            
        Returns:
            Dictionary with 'formats' key containing compiled formats
        """
        formats = []
        failed = []
        import_logger = get_import_logger()
        
        # Don't try to predict - we'll count as we go
        import_logger.start(0, 0)  # Will update counts as we compile
        
        for filename in filenames:
            try:
                # Load YAML
                format_yaml = load_yaml(f"custom_format/{filename}.yml")
                
                # Compile to API structure
                compiled = compile_format_to_api_structure(format_yaml, self.arr_type)
                
                # Add unique suffix if needed
                if self.import_as_unique:
                    compiled['name'] = self.add_unique_suffix(compiled['name'])
                
                formats.append(compiled)
                import_logger.update_compilation(filename)
                
            except Exception as e:
                import_logger.error(f"{e}", filename, 'compilation')
                failed.append(filename)
                # Don't count failed compilations
        
        # Set final compilation count
        import_logger.total_compilation = len(formats)
        import_logger.current_compilation = len(formats)
        import_logger.compilation_complete()
        
        return {'formats': formats}
    
    def import_data(self, compiled_data: Dict[str, Any], dry_run: bool = False) -> Dict[str, Any]:
        """
        Import compiled formats to Arr instance.
        
        Args:
            compiled_data: Dictionary with 'formats' key
            dry_run: If True, simulate import without making changes
            
        Returns:
            Import results
        """
        # Get existing formats
        existing = self.arr.get_all_formats()
        existing_map = {f['name']: f['id'] for f in existing}
        
        results = {
            'added': 0,
            'updated': 0,
            'failed': 0,
            'details': []
        }
        
        import_logger = get_import_logger()
        
        # Set import count
        import_logger.total_import = len(compiled_data['formats'])
        import_logger._import_shown = False  # Reset import shown flag
        
        for format_data in compiled_data['formats']:
            format_name = format_data['name']
            
            try:
                if format_name in existing_map:
                    # Update existing
                    if not dry_run:
                        format_data['id'] = existing_map[format_name]
                        self.arr.put(
                            f"/api/v3/customformat/{existing_map[format_name]}",
                            format_data
                        )
                    
                    import_logger.update_import(format_name, "updated")
                    results['updated'] += 1
                    results['details'].append({
                        'name': format_name,
                        'action': 'updated'
                    })
                else:
                    # Add new
                    if not dry_run:
                        self.arr.post("/api/v3/customformat", format_data)
                    
                    import_logger.update_import(format_name, "added")
                    results['added'] += 1
                    results['details'].append({
                        'name': format_name,
                        'action': 'added'
                    })
                    
            except Exception as e:
                import_logger.update_import(format_name, "failed")
                import_logger.error(f"Failed to import format {format_name}: {e}", format_name)
                results['failed'] += 1
                results['details'].append({
                    'name': format_name,
                    'action': 'failed',
                    'error': str(e)
                })
        
        # Show import summary
        import_logger.import_complete()
        import_logger._import_shown = True
        
        return results