"""Profile import strategy."""
import logging
from typing import Dict, List, Any, Set
from .base import ImportStrategy
from ..utils import load_yaml, extract_format_names, generate_language_formats
from ..compiler import compile_format_to_api_structure, compile_profile_to_api_structure
from ..logger import get_import_logger

logger = logging.getLogger(__name__)


class ProfileStrategy(ImportStrategy):
    """Strategy for importing quality profiles."""
    
    def compile(self, filenames: List[str]) -> Dict[str, Any]:
        """
        Compile profile files and their dependent formats to API-ready format.
        
        Args:
            filenames: List of profile filenames (without .yml)
            
        Returns:
            Dictionary with 'profiles' and 'formats' keys
        """
        profiles = []
        all_formats = []
        processed_formats: Set[str] = set()
        # Cache for language formats to avoid recompiling
        language_formats_cache: Dict[str, List[Dict]] = {}
        
        import_logger = get_import_logger()
        
        # Don't try to predict - we'll count as we go
        import_logger.start(0, 0)  # Will update counts as we compile
        
        for filename in filenames:
            try:
                # Load profile YAML
                profile_yaml = load_yaml(f"profile/{filename}.yml")
                
                # Extract referenced custom formats
                format_names = extract_format_names(profile_yaml)
                
                for format_name in format_names:
                    # Skip if already processed
                    display_name = self.add_unique_suffix(format_name) if self.import_as_unique else format_name
                    if display_name in processed_formats:
                        continue
                    
                    try:
                        format_yaml = load_yaml(f"custom_format/{format_name}.yml")
                        compiled_format = compile_format_to_api_structure(format_yaml, self.arr_type)
                        
                        if self.import_as_unique:
                            compiled_format['name'] = self.add_unique_suffix(compiled_format['name'])
                        
                        all_formats.append(compiled_format)
                        processed_formats.add(compiled_format['name'])
                        import_logger.update_compilation(format_name)
                        
                    except Exception as e:
                        # Count the failed attempt
                        import_logger.update_compilation(f"{format_name} (failed)")
                
                # Generate language formats if needed
                language = profile_yaml.get('language', 'any')
                if language != 'any' and '_' in language:
                    # Check cache first
                    if language not in language_formats_cache:
                        language_formats = generate_language_formats(language, self.arr_type)
                        compiled_langs = []
                        
                        for lang_format in language_formats:
                            lang_name = lang_format.get('name', 'Language format')
                            compiled_lang = compile_format_to_api_structure(lang_format, self.arr_type)
                            
                            if self.import_as_unique:
                                compiled_lang['name'] = self.add_unique_suffix(compiled_lang['name'])
                            
                            compiled_langs.append(compiled_lang)
                            
                            # Add to all_formats only on first compilation
                            if compiled_lang['name'] not in processed_formats:
                                all_formats.append(compiled_lang)
                                processed_formats.add(compiled_lang['name'])
                                import_logger.update_compilation(lang_name)
                        
                        # Store in cache
                        language_formats_cache[language] = compiled_langs
                
                # Compile profile
                compiled_profile = compile_profile_to_api_structure(profile_yaml, self.arr_type)
                
                if self.import_as_unique:
                    compiled_profile['name'] = self.add_unique_suffix(compiled_profile['name'])
                    
                    # Update format references in profile
                    for item in compiled_profile.get('formatItems', []):
                        item['name'] = self.add_unique_suffix(item['name'])
                
                profiles.append(compiled_profile)
                import_logger.update_compilation(f"Profile: {compiled_profile['name']}")
                
            except Exception as e:
                import_logger.error(f"{str(e)}", f"Profile: {filename}", 'compilation')
                import_logger.update_compilation(f"Profile: {filename} (failed)")
        
        # Set total to what we actually attempted
        import_logger.total_compilation = import_logger.current_compilation
        import_logger.compilation_complete()
        
        return {
            'profiles': profiles,
            'formats': all_formats
        }
    
    def import_data(self, compiled_data: Dict[str, Any], dry_run: bool = False) -> Dict[str, Any]:
        """
        Import compiled profiles and formats to Arr instance.
        
        Args:
            compiled_data: Dictionary with 'profiles' and 'formats' keys
            dry_run: If True, simulate import without making changes
            
        Returns:
            Import results
        """
        results = {
            'added': 0,
            'updated': 0,
            'failed': 0,
            'details': []
        }
        
        import_logger = get_import_logger()
        
        # Set total import count
        import_logger.total_import = len(compiled_data['formats']) + len(compiled_data['profiles'])
        import_logger._import_shown = False  # Reset import shown flag
        
        # Import formats first
        if compiled_data['formats']:
            existing_formats = self.arr.get_all_formats()
            format_map = {f['name']: f['id'] for f in existing_formats}
            
            formats_failed = []
            
            for format_data in compiled_data['formats']:
                format_name = format_data['name']
                
                try:
                    if format_name in format_map:
                        # Update existing
                        if not dry_run:
                            format_data['id'] = format_map[format_name]
                            self.arr.put(
                                f"/api/v3/customformat/{format_map[format_name]}",
                                format_data
                            )
                        import_logger.update_import(format_name, "updated")
                    else:
                        # Add new
                        if dry_run:
                            # In dry run, pretend we got an ID  
                            # Use a predictable fake ID for dry run
                            fake_id = 999000 + len(format_map)
                            format_map[format_name] = fake_id
                        else:
                            response = self.arr.post("/api/v3/customformat", format_data)
                            format_map[format_name] = response['id']
                        import_logger.update_import(format_name, "added")
                        
                except Exception as e:
                    import_logger.update_import(format_name, "failed")
                    import_logger.error(f"Failed to import format {format_name}: {e}", format_name)
                    formats_failed.append(format_name)
        
        # Refresh format map for profile syncing (MUST be done after importing formats)
        if not dry_run:
            # In real mode, get the actual current formats from the server
            existing_formats = self.arr.get_all_formats()
            format_map = {f['name']: f['id'] for f in existing_formats}
        # In dry run mode, format_map already has fake IDs from above
        
        # Sync format IDs in profiles
        for profile in compiled_data['profiles']:
            synced_items = []
            processed_formats = set()
            
            # First add all explicitly defined formats with their scores
            for item in profile.get('formatItems', []):
                if item['name'] in format_map:
                    synced_items.append({
                        'format': format_map[item['name']],
                        'name': item['name'],
                        'score': item.get('score', 0)
                    })
                    processed_formats.add(item['name'])
                else:
                    import_logger.warning(f"Format {item['name']} not found for profile {profile['name']}")
            
            # Then add ALL other existing formats with score 0 (Arr requirement)
            for format_name, format_id in format_map.items():
                if format_name not in processed_formats:
                    synced_items.append({
                        'format': format_id,
                        'name': format_name,
                        'score': 0
                    })
            
            profile['formatItems'] = synced_items
        
        # Import profiles
        existing_profiles = self.arr.get_all_profiles()
        profile_map = {p['name']: p['id'] for p in existing_profiles}
        
        for profile_data in compiled_data['profiles']:
            profile_name = profile_data['name']
            
            try:
                if profile_name in profile_map:
                    # Update existing
                    if not dry_run:
                        profile_data['id'] = profile_map[profile_name]
                        self.arr.put(
                            f"/api/v3/qualityprofile/{profile_data['id']}",
                            profile_data
                        )
                    
                    import_logger.update_import(f"Profile: {profile_name}", "updated")
                    results['updated'] += 1
                    results['details'].append({
                        'name': profile_name,
                        'action': 'updated'
                    })
                else:
                    # Add new
                    if not dry_run:
                        self.arr.post("/api/v3/qualityprofile", profile_data)
                    
                    import_logger.update_import(f"Profile: {profile_name}", "added")
                    results['added'] += 1
                    results['details'].append({
                        'name': profile_name,
                        'action': 'added'
                    })
                    
            except Exception as e:
                import_logger.update_import(f"Profile: {profile_name}", "failed")
                import_logger.error(f"Failed to import profile {profile_name}: {e}", profile_name)
                results['failed'] += 1
                results['details'].append({
                    'name': profile_name,
                    'action': 'failed',
                    'error': str(e)
                })
        
        # Show import summary
        import_logger.import_complete()
        import_logger._import_shown = True
        
        return results