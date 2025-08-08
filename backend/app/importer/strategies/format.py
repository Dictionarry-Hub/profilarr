"""Format import strategy."""
import logging
from typing import Dict, List, Any
from .base import ImportStrategy
from ..utils import load_yaml
from ..compiler import compile_format_to_api_structure

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
        
        logger.info(f"Compiling {len(filenames)} custom formats")
        
        for i, filename in enumerate(filenames, 1):
            logger.debug(f"[COMPILE] Compiling format {filename} ({i}/{len(filenames)})")
            try:
                # Load YAML
                format_yaml = load_yaml(f"custom_format/{filename}.yml")
                
                # Compile to API structure
                compiled = compile_format_to_api_structure(format_yaml, self.arr_type)
                
                # Add unique suffix if needed
                if self.import_as_unique:
                    compiled['name'] = self.add_unique_suffix(compiled['name'])
                
                formats.append(compiled)
                
            except Exception as e:
                logger.error(f"Failed to compile format {filename}: {e}")
                failed.append(filename)
                # Continue with other formats
        
        # Log summary
        logger.info(f"Compilation complete: {len(formats)} formats compiled")
        if failed:
            logger.warning(f"Failed to compile {len(failed)} formats: {', '.join(failed)}")
        
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
        
        added_names = []
        updated_names = []
        failed_names = []
        
        logger.info(f"Importing {len(compiled_data['formats'])} formats to {self.arr_type}")
        
        for format_data in compiled_data['formats']:
            format_name = format_data['name']
            
            try:
                if format_name in existing_map:
                    # Update existing
                    if dry_run:
                        logger.debug(f"[DRY RUN] Would update format: {format_name}")
                    else:
                        format_data['id'] = existing_map[format_name]
                        self.arr.put(
                            f"/api/v3/customformat/{existing_map[format_name]}",
                            format_data
                        )
                        logger.debug(f"Updated format: {format_name}")
                        updated_names.append(format_name)
                    
                    results['updated'] += 1
                    results['details'].append({
                        'name': format_name,
                        'action': 'updated'
                    })
                else:
                    # Add new
                    if dry_run:
                        logger.debug(f"[DRY RUN] Would add format: {format_name}")
                    else:
                        self.arr.post("/api/v3/customformat", format_data)
                        logger.debug(f"Added format: {format_name}")
                        added_names.append(format_name)
                    
                    results['added'] += 1
                    results['details'].append({
                        'name': format_name,
                        'action': 'added'
                    })
                    
            except Exception as e:
                results['failed'] += 1
                results['details'].append({
                    'name': format_name,
                    'action': 'failed',
                    'error': str(e)
                })
                logger.error(f"Failed to import format {format_name}: {e}")
                failed_names.append(format_name)
        
        # Log summary
        if added_names:
            logger.info(f"Added {len(added_names)} formats: {', '.join(added_names[:5])}{'...' if len(added_names) > 5 else ''}")
        if updated_names:
            logger.info(f"Updated {len(updated_names)} formats: {', '.join(updated_names[:5])}{'...' if len(updated_names) > 5 else ''}")
        if failed_names:
            logger.warning(f"Failed {len(failed_names)} formats: {', '.join(failed_names)}")
        
        return results